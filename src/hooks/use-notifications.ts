"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UnreadCount {
  room_id: string;
  room_name: string;
  unreadCount: number;
  latestMessageTime?: string;
}

interface NotificationState {
  hasUnreadMessages: boolean;
  totalUnreadCount: number;
  roomCounts: UnreadCount[];
  loading: boolean;
  error: string | null;
}

const supabase = createSupabaseBrowserClient();

export function useNotifications() {
  const { user } = useAuthStore();
  const [notificationState, setNotificationState] = useState<NotificationState>({
    hasUnreadMessages: false,
    totalUnreadCount: 0,
    roomCounts: [],
    loading: true,
    error: null
  });

  // 실시간 구독 채널 상태 관리
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [channelStatus, setChannelStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // React 19 최적화: 디바운싱을 위한 타임아웃 참조
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 읽지 않은 메시지 카운트 로드 - 에러 처리 강화
  const loadUnreadCounts = useCallback(async () => {
    if (!user) return;

    try {
      setNotificationState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/chat/unread', {
        headers: {
          'Cache-Control': 'no-cache',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      setNotificationState(prev => ({
        ...prev,
        hasUnreadMessages: data.hasUnreadMessages || false,
        totalUnreadCount: data.totalUnreadCount || 0,
        roomCounts: data.roomCounts || [],
        loading: false,
        error: null
      }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading unread counts:', error);
      }
      setNotificationState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [user]);

  // Supabase 최적화: 읽음 처리 with optimistic updates
  const markAsRead = useCallback(async (roomId: string, messageId?: string) => {
    if (!user || !roomId) return;

    // 즉시 로컬 상태 업데이트 (Optimistic UI)
    setNotificationState(prev => {
      const updatedRoomCounts = prev.roomCounts.map(room =>
        room.room_id === roomId
          ? { ...room, unreadCount: 0 }
          : room
      );

      const newTotalCount = updatedRoomCounts.reduce((sum, room) => sum + room.unreadCount, 0);

      return {
        ...prev,
        roomCounts: updatedRoomCounts,
        totalUnreadCount: newTotalCount,
        hasUnreadMessages: newTotalCount > 0
      };
    });

    try {
      const response = await fetch('/api/chat/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          room_id: roomId,
          message_id: messageId
        })
      });

      if (!response.ok) {
        // API 응답이 실패한 경우에만 상태를 롤백
        const errorData = await response.json().catch(() => ({}));

        // 403/404는 조용히 처리 (이미 optimistic update 완료)
        if (response.status === 403 || response.status === 404) {
          if (process.env.NODE_ENV === 'development') {
            console.info(`Room access info for ${roomId}:`, errorData);
          }
          return; // 로컬 상태는 이미 업데이트됨
        }

        // 5xx 서버 에러의 경우 상태 롤백
        if (response.status >= 500) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Server error, will retry:', errorData);
          }
          // 실제 데이터로 새로고침하여 정확한 상태 복원
          setTimeout(() => loadUnreadCounts(), 1000);
          return;
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // 성공한 경우: 서버와 동기화 확인을 위한 백그라운드 새로고침
      setTimeout(() => loadUnreadCounts(), 300);

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('markAsRead network error:', error);
      }
      // 네트워크 에러의 경우 상태 복원
      setTimeout(() => loadUnreadCounts(), 2000);
    }
  }, [user, loadUnreadCounts]);

  // 특정 방의 읽지 않은 메시지 수 가져오기
  const getUnreadCount = useCallback((roomId: string): number => {
    const room = notificationState.roomCounts.find(r => r.room_id === roomId);
    return room?.unreadCount || 0;
  }, [notificationState.roomCounts]);

  // 안전한 채널 정리 함수
  const cleanupChannel = useCallback((channel: RealtimeChannel) => {
    try {
      if (channel && typeof channel.unsubscribe === 'function') {
        // 연결 상태 확인 후 정리
        const status = channel?.state;
        if (status && status !== 'closed' && status !== 'leaving') {
          channel.unsubscribe();
        }
        supabase.removeChannel(channel);
      }
    } catch (error) {
      // 정리 중 오류 발생해도 조용히 처리
      if (process.env.NODE_ENV === 'development') {
        console.warn('Channel cleanup warning:', error);
      }
    }
  }, []);

  // 실시간 구독 설정 - WebSocket 연결 상태 추적 강화
  useEffect(() => {
    if (!user) {
      // 기존 채널 정리
      if (realtimeChannel) {
        cleanupChannel(realtimeChannel);
        setRealtimeChannel(null);
      }
      setChannelStatus('disconnected');
      return;
    }

    // 이미 같은 사용자의 채널이 연결되어 있으면 재사용
    if (realtimeChannel && channelStatus === 'connected') {
      return;
    }

    // 기존 채널 정리
    if (realtimeChannel) {
      cleanupChannel(realtimeChannel);
    }

    setChannelStatus('connecting');

    // 새 채널 생성 및 구독
    const channel = supabase
      .channel(`user_notifications:${user.id}`, {
        config: {
          broadcast: { self: false }, // 자신의 브로드캐스트는 받지 않음
          presence: { key: user.id } // 사용자별 고유 키
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          // Supabase 최적화: 새 메시지 실시간 처리
          if (payload.new && payload.new.sender_id !== user.id) {
            // 디바운싱을 위한 ref 사용 (React 19 최적화)
            if (loadTimeoutRef.current) {
              clearTimeout(loadTimeoutRef.current);
            }
            loadTimeoutRef.current = setTimeout(() => {
              loadUnreadCounts();
              loadTimeoutRef.current = null;
            }, 300);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reads',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // 읽음 상태 변경 시 즉시 업데이트
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
          }
          loadTimeoutRef.current = setTimeout(() => {
            loadUnreadCounts();
            loadTimeoutRef.current = null;
          }, 150);
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setChannelStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setChannelStatus('disconnected');
        }
      });

    setRealtimeChannel(channel);

    // 정리 함수 - React 19 최적화
    return () => {
      // 대기 중인 타임아웃 정리
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      cleanupChannel(channel);
      setChannelStatus('disconnected');
    };
  }, [user, cleanupChannel]); // loadUnreadCounts 의존성 제거로 무한 루프 방지

  // 초기 로드 및 사용자 상태 변경 처리
  useEffect(() => {
    if (user) {
      loadUnreadCounts();
    } else {
      // 로그아웃 시 상태 초기화
      setNotificationState({
        hasUnreadMessages: false,
        totalUnreadCount: 0,
        roomCounts: [],
        loading: false,
        error: null
      });
      setChannelStatus('disconnected');
    }
  }, [user, loadUnreadCounts]);

  return {
    ...notificationState,
    markAsRead,
    getUnreadCount,
    refresh: loadUnreadCounts
  };
}
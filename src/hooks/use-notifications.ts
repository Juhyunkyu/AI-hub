"use client";

import { useEffect, useCallback, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = createSupabaseBrowserClient();

// ✅ Nav바 전용 최소 실시간 구독 (전역 페이지에서 알림 업데이트용)
// - /chat 페이지에서는 use-global-chat-rooms-subscription.ts가 동작
// - 다른 페이지에서는 이 훅의 구독이 Nav바 알림을 업데이트
// - Optimistic Update 없음 → 중복 카운트 문제 방지
// - invalidateQueries만 호출 → 서버 데이터 기반 정확한 카운트

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

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // TanStack Query: /api/chat/unread 캐싱 + in-flight dedupe + 백오프
  const unreadQuery = useQuery({
    queryKey: queryKeys.chat.unreadCount(),
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch('/api/chat/unread', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = (errorData && errorData.error) || `HTTP ${response.status}`;
        const err: any = new Error(message);
        (err.status = response.status);
        throw err;
      }
      return response.json();
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    select: (data: any): Omit<NotificationState, 'loading' | 'error'> => ({
      hasUnreadMessages: !!data?.hasUnreadMessages,
      totalUnreadCount: typeof data?.totalUnreadCount === 'number' ? data.totalUnreadCount : 0,
      roomCounts: Array.isArray(data?.roomCounts) ? data.roomCounts : []
    })
  });

  // 쿼리 무효화(디바운스) - 외부에서 호출 가능하도록 유지
  const invalidateUnreadRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleInvalidateUnread = useCallback((delayMs: number) => {
    if (invalidateUnreadRef.current) {
      clearTimeout(invalidateUnreadRef.current);
    }
    invalidateUnreadRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.unreadCount() });
      invalidateUnreadRef.current = null;
    }, delayMs);
  }, [queryClient]);

  // Supabase 최적화: 읽음 처리 with optimistic updates
  const markAsRead = useCallback(async (roomId: string, messageId?: string) => {
    if (!user || !roomId) return;

    // Optimistic update: 캐시 데이터 즉시 갱신
    queryClient.setQueryData(queryKeys.chat.unreadCount(), (prev: any) => {
      const roomCounts = Array.isArray(prev?.roomCounts) ? prev.roomCounts : [];
      const patched = roomCounts.map((r: any) => r?.room_id === roomId ? { ...r, unreadCount: 0 } : r);
      const total = patched.reduce((sum: number, r: any) => sum + (r?.unreadCount || 0), 0);
      return {
        ...(prev || {}),
        hasUnreadMessages: total > 0,
        totalUnreadCount: total,
        roomCounts: patched
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
          scheduleInvalidateUnread(1000);
          return;
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // 성공한 경우: 서버와 동기화 확인을 위한 백그라운드 새로고침
      scheduleInvalidateUnread(300);

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('markAsRead network error:', error);
      }
      // 네트워크 에러의 경우 상태 복원
      scheduleInvalidateUnread(2000);
    }
  }, [user, queryClient, scheduleInvalidateUnread]);

  // 특정 방의 읽지 않은 메시지 수 가져오기
  const getUnreadCount = useCallback((roomId: string): number => {
    const room = unreadQuery.data?.roomCounts?.find((r: any) => r?.room_id === roomId);
    return room?.unreadCount || 0;
  }, [unreadQuery.data]);

  // ✅ Nav바 전용 실시간 구독 (전역 페이지에서 알림 업데이트)
  // - 채널명: notifications:user:${userId} (독립 채널)
  // - /chat 페이지의 global-rooms 채널과 별도로 동작
  // - Optimistic Update 없음 → 서버 데이터 기반 정확한 카운트
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) {
      // 사용자 없으면 채널 정리
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const subscribeToNotifications = async () => {
      // 기존 채널 정리
      if (channelRef.current) {
        try {
          await supabase.removeChannel(channelRef.current);
        } catch {
          // 무시
        }
        channelRef.current = null;
      }

      // Realtime 인증 설정
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      // ✅ Nav바 전용 독립 채널 (global-rooms와 같은 이벤트 수신)
      const channelName = `notifications:user:${user.id}`;
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id }
        }
      });

      channel
        .on('broadcast', { event: 'new_message' }, () => {
          if (!isMounted) return;

          // ✅ Optimistic Update 없음 - invalidateQueries만 호출
          // 서버에서 정확한 카운트를 가져와서 중복 문제 방지
          if (process.env.NODE_ENV === 'development') {
            console.log('🔔 [Notifications] New message received, invalidating unread count');
          }
          scheduleInvalidateUnread(100); // 짧은 딜레이로 debounce
        })
        .on('broadcast', { event: 'room_joined' }, () => {
          if (!isMounted) return;
          scheduleInvalidateUnread(100);
        })
        .on('broadcast', { event: 'room_left' }, () => {
          if (!isMounted) return;
          scheduleInvalidateUnread(100);
        })
        .subscribe((status) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔔 [Notifications] Channel status: ${status}`);
          }
        });

      if (isMounted) {
        channelRef.current = channel;
      }
    };

    subscribeToNotifications();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
    };
  }, [user, scheduleInvalidateUnread]);

  return {
    hasUnreadMessages: !!unreadQuery.data?.hasUnreadMessages,
    totalUnreadCount: unreadQuery.data?.totalUnreadCount || 0,
    roomCounts: unreadQuery.data?.roomCounts || [],
    loading: unreadQuery.isLoading || unreadQuery.isFetching,
    error: unreadQuery.error ? (unreadQuery.error as Error).message : null,
    markAsRead,
    getUnreadCount,
    refresh: () => queryClient.invalidateQueries({ queryKey: queryKeys.chat.unreadCount() })
  };
}
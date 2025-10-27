"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { channelRegistry } from "@/lib/realtime/channel-registry";

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

  // 실시간 구독 채널 상태 관리
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [channelStatus, setChannelStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // React 19 최적화: 디바운싱을 위한 타임아웃 참조
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 쿼리 무효화(디바운스)
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

  // ✅ 채널 레지스트리 기반 정리 함수
  const cleanup = useCallback(async () => {
    if (realtimeChannel && user) {
      const channelName = `global:user:${user.id}:rooms`;
      await channelRegistry.releaseChannel(channelName);
      setRealtimeChannel(null);
    }
    setChannelStatus('disconnected');
  }, [realtimeChannel, user]);

  // ✅ 실시간 구독 설정 - Channel Registry 통합
  useEffect(() => {
    if (!user) {
      cleanup();
      return;
    }

    const subscribeToNotifications = async () => {
      try {
        // ✅ 채널 레지스트리로 중복 구독 방지
        const channelName = `global:user:${user.id}:rooms`;

        // 기존 채널 정리
        if (realtimeChannel) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🧹 [use-notifications] Releasing existing channel for user: ${user.id}`);
          }
          await channelRegistry.releaseChannel(channelName);
          setRealtimeChannel(null);
        }

        setChannelStatus('connecting');

        // Realtime 인증 설정
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ [use-notifications] Realtime auth set for user: ${user.id}`);
          }
        }

        // ✅ 채널 레지스트리에서 채널 가져오기 (중복 방지)
        const channelInfo = channelRegistry.getChannelInfo(channelName);
        const isExistingChannel = channelInfo.exists;

        const channel = await channelRegistry.getOrCreateChannel(channelName, {
          broadcast: { self: false },
          presence: { key: user.id }
        });

        if (process.env.NODE_ENV === 'development') {
          console.log(`🎧 [use-notifications] Registering event listeners for ${isExistingChannel ? 'existing' : 'new'} channel`);
        }

        // ✅ 항상 이 훅의 이벤트 리스너 등록 (각 훅은 독립적으로 이벤트 처리)
        channel
          // ✅ 새 메시지 알림 (Nav 바 카운트 업데이트)
          .on('broadcast', { event: 'new_message' }, (payload) => {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔔 [use-notifications] Received broadcast:`, payload);
            }

            const { room_id, sender_id, message_preview } = payload.payload;

            // 자신의 메시지는 무시
            if (sender_id === user.id) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`⚠️ [use-notifications] Ignoring own message from ${sender_id}`);
              }
              return;
            }

            if (process.env.NODE_ENV === 'development') {
              console.log(`🔔 [use-notifications] Processing notification:`, { room_id, sender_id, message_preview });
            }

            // 즉시 카운트 증가 (Optimistic Update)
            queryClient.setQueryData(queryKeys.chat.unreadCount(), (prev: any) => {
              if (!prev) return prev;

              const roomCounts = Array.isArray(prev.roomCounts) ? prev.roomCounts : [];
              const existingRoom = roomCounts.find((r: any) => r?.room_id === room_id);

              let newRoomCounts;
              if (existingRoom) {
                // 기존 방의 카운트 증가
                newRoomCounts = roomCounts.map((r: any) =>
                  r?.room_id === room_id
                    ? { ...r, unreadCount: (r.unreadCount || 0) + 1 }
                    : r
                );
              } else {
                // 새로운 방 추가
                newRoomCounts = [...roomCounts, { room_id, unreadCount: 1 }];
              }

              const total = newRoomCounts.reduce((sum: number, r: any) => sum + (r?.unreadCount || 0), 0);

              const updatedData = {
                ...(prev || {}),
                hasUnreadMessages: total > 0,
                totalUnreadCount: total,
                roomCounts: newRoomCounts
              };

              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [use-notifications] Updated unread count:`, updatedData);
              }

              return updatedData;
            });

            // 서버와 동기화 확인을 위한 백그라운드 새로고침
            scheduleInvalidateUnread(1000);
          })
          // 읽음 상태 변경 시 (읽음 처리 broadcast)
          .on('broadcast', { event: 'message_read_notification' }, (payload) => {
            const { room_id } = payload.payload;

            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ [Nav Notification] Messages read in room ${room_id}`);
            }

            // 읽음 상태 변경 시 빠른 무효화
            scheduleInvalidateUnread(150);
          });

        // ✅ 새 채널일 때만 subscribe (이미 구독된 채널에 subscribe 호출 시 timeout 발생)
        if (!isExistingChannel) {
          channel.subscribe(async (status, err) => {
            if (status === 'SUBSCRIBED') {
              setChannelStatus('connected');
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [use-notifications] Subscribed for user: ${user.id}`);
              }
            } else if (status === 'CHANNEL_ERROR') {
              setChannelStatus('disconnected');
              if (process.env.NODE_ENV === 'development') {
                console.error('❌ [use-notifications] Channel error:', err);
              }
            } else if (status === 'TIMED_OUT') {
              setChannelStatus('disconnected');
              if (process.env.NODE_ENV === 'development') {
                console.error('⏰ [use-notifications] Connection timed out');
              }
            } else if (status === 'CLOSED') {
              setChannelStatus('disconnected');
              if (process.env.NODE_ENV === 'development') {
                console.warn('🔌 [use-notifications] Connection closed');
              }
            }
          });
        } else {
          // ✅ 기존 채널 재사용 - 이미 구독됨, 상태만 업데이트
          setChannelStatus('connected');
          if (process.env.NODE_ENV === 'development') {
            console.log(`♻️ [use-notifications] Reusing existing channel (already subscribed)`);
          }
        }

        setRealtimeChannel(channel);

      } catch (error) {
        setChannelStatus('disconnected');
        console.error('❌ [use-notifications] Failed to subscribe:', error);
      }
    };

    subscribeToNotifications();

    // cleanup 함수 직접 반환
    return () => cleanup();
  }, [user]); // ✅ user만 dependency로 설정

  // 사용자 변경 시 상태 초기화 (쿼리는 enabled 플래그로 제어)
  useEffect(() => {
    if (!user) {
      setChannelStatus('disconnected');
    }
  }, [user]);

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
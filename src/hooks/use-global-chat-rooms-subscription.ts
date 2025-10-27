"use client";

/**
 * ✅ 전역 채팅방 실시간 구독 훅 (Broadcast 방식)
 *
 * Supabase Realtime Broadcast 기반 구현
 *
 * 기능:
 * 1. 채팅방 초대 시 → 즉시 리스트 새로고침 (room_joined 이벤트)
 * 2. 채팅방 나가기 시 → 즉시 리스트에서 제거 (room_left 이벤트)
 * 3. 새 메시지 전송 시 → 즉시 리스트 업데이트 (new_message 이벤트) ⚡
 * 4. /chat 페이지 외부에서도 작동 (전역 구독)
 *
 * 성능:
 * - 지연시간: 20-100ms (Postgres Changes 대비 3-5배 향상)
 * - 서버 부하: 낮음 (DB 폴링 없음)
 *
 * 패턴:
 * - 타이핑 인디케이터와 동일한 Broadcast 패턴 사용
 * - 채널: `global:user:${user.id}:rooms`
 * - 이벤트: room_joined, room_left, new_message
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { channelRegistry } from "@/lib/realtime/channel-registry";

const supabase = createSupabaseBrowserClient();

interface RoomUpdatePayload {
  type: 'new_message' | 'room_joined' | 'room_left';
  room_id?: string;
  last_message?: {
    content: string;
    sender_id: string;
    sender_username: string;
    message_type: string;
    created_at: string;
  };
}

interface GlobalChatRoomsSubscriptionProps {
  onRoomsChanged?: (update?: RoomUpdatePayload) => void; // 채팅방 목록 변경 시 호출되는 콜백
}

interface GlobalChatRoomsSubscriptionReturn {
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
}

export function useGlobalChatRoomsSubscription({
  onRoomsChanged
}: GlobalChatRoomsSubscriptionProps): GlobalChatRoomsSubscriptionReturn {
  const { user } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // ✅ onRoomsChanged를 useRef로 관리하여 최신 참조 유지
  const onRoomsChangedRef = useRef(onRoomsChanged);

  useEffect(() => {
    onRoomsChangedRef.current = onRoomsChanged;
  }, [onRoomsChanged]);

  // 정리 함수 - 채널 레지스트리 사용
  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      const channelName = `global:user:${user?.id}:rooms`;
      await channelRegistry.releaseChannel(channelName);
      channelRef.current = null;
    }
    setIsConnected(false);
    setConnectionState('disconnected');
    setError(null);
  }, [user?.id]);

  // 전역 채팅방 Broadcast 구독
  useEffect(() => {
    if (!user) {
      cleanup();
      return;
    }

    const subscribeToGlobalRooms = async () => {
      try {
        // ✅ 채널 레지스트리로 중복 구독 방지
        const channelName = `global:user:${user.id}:rooms`;

        // 기존 채널 정리
        if (channelRef.current) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🧹 [Global Rooms] Releasing existing channel for user: ${user.id}`);
          }
          await channelRegistry.releaseChannel(channelName);
          channelRef.current = null;
        }

        setConnectionState('connecting');
        setError(null);

        // Realtime 인증 설정
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ [Global Rooms] Realtime auth set for user: ${user.id}`);
          }
        }

        // ✅ 채널 레지스트리에서 채널 가져오기 (중복 방지)
        const channelInfo = channelRegistry.getChannelInfo(channelName);
        const isExistingChannel = channelInfo.exists;

        const channel = await channelRegistry.getOrCreateChannel(channelName, {
          broadcast: { self: false },
          presence: { key: user.id }
        });

        // ✅ 새로 생성된 채널에만 이벤트 리스너 등록 (중복 방지)
        if (!isExistingChannel) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🎧 [Global Rooms] Registering event listeners for new channel`);
          }

          channel
          // 채팅방 초대 이벤트
          .on('broadcast', { event: 'room_joined' }, (payload) => {
            const { user_id, room_id } = payload.payload;

            // 현재 사용자에게 온 이벤트만 처리
            if (user_id === user.id) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`📥 [Global Rooms] Room joined:`, { user_id, room_id });
              }

              // 채팅방 목록 새로고침 (전체 API 호출 필요)
              if (onRoomsChangedRef.current) {
                onRoomsChangedRef.current({ type: 'room_joined', room_id });
              }
            }
          })
          // 채팅방 나가기 이벤트
          .on('broadcast', { event: 'room_left' }, (payload) => {
            const { user_id, room_id } = payload.payload;

            // 현재 사용자에게 온 이벤트만 처리
            if (user_id === user.id) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`📤 [Global Rooms] Room left:`, { user_id, room_id });
              }

              // 채팅방 목록 새로고침 (전체 API 호출 필요)
              if (onRoomsChangedRef.current) {
                onRoomsChangedRef.current({ type: 'room_left', room_id });
              }
            }
          })
          // ✅ 새 메시지 이벤트 - 채팅 리스트 실시간 업데이트
          .on('broadcast', { event: 'new_message' }, (payload) => {
            const { room_id, sender_id, content, message_type, sender_username } = payload.payload;

            if (process.env.NODE_ENV === 'development') {
              console.log(`💬 [Global Rooms] New message in room ${room_id}:`, {
                sender_id,
                sender_username,
                content: message_type === 'text' ? content : `[${message_type}]`,
                is_own: sender_id === user.id
              });
            }

            // ✅ Optimistic Update: payload를 전달하여 화면 깜빡임 없이 업데이트
            if (onRoomsChangedRef.current) {
              onRoomsChangedRef.current({
                type: 'new_message',
                room_id,
                last_message: {
                  content,
                  sender_id,
                  sender_username,
                  message_type,
                  created_at: new Date().toISOString()
                }
              });
            }
          })
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setConnectionState('connected');
              setError(null);
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [Global Rooms] Subscribed for user: ${user.id}`);
              }
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              setConnectionState('error');
              setError(err?.message || '채널 연결 오류');
              if (process.env.NODE_ENV === 'development') {
                console.error('❌ [Global Rooms] Channel error:', err);
              }
            } else if (status === 'TIMED_OUT') {
              setIsConnected(false);
              setConnectionState('error');
              setError('연결 시간 초과');
              if (process.env.NODE_ENV === 'development') {
                console.error('⏰ [Global Rooms] Connection timed out');
              }
            } else if (status === 'CLOSED') {
              setIsConnected(false);
              setConnectionState('disconnected');
              if (process.env.NODE_ENV === 'development') {
                console.warn('🔌 [Global Rooms] Connection closed');
              }
            }
          });
        } else {
          // ✅ 기존 채널 재사용 - 리스너 등록 없이 상태만 업데이트
          setIsConnected(true);
          setConnectionState('connected');
          setError(null);
          if (process.env.NODE_ENV === 'development') {
            console.log(`♻️ [Global Rooms] Reusing existing channel, skipping listener registration`);
          }
        }

        channelRef.current = channel;

      } catch (error) {
        setConnectionState('error');
        setError(error instanceof Error ? error.message : '알 수 없는 오류');
        console.error('❌ [Global Rooms] Failed to subscribe:', error);
      }
    };

    subscribeToGlobalRooms();

    // cleanup 함수 직접 반환
    return () => cleanup();
  }, [user]); // ✅ user만 dependency로 설정

  return {
    isConnected,
    connectionState,
    error
  };
}

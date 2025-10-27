"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "@/types/chat";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { channelRegistry } from "@/lib/realtime/channel-registry";

// 기존 프로젝트의 Supabase 클라이언트 사용 (중복 인스턴스 방지)
const supabase = createSupabaseBrowserClient();

// Broadcast payload 타입 정의
interface MessageChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: ChatMessage;
  old: Partial<ChatMessage>;
  schema: string;
  table: string;
  commit_timestamp: string;
  errors: null;
}

interface RealtimeChatHookProps {
  roomId: string | null;
  onNewMessage?: (message: ChatMessage) => void;
  onMessageUpdate?: (message: ChatMessage) => void;
  onMessageDelete?: (messageId: string) => void;
  onSyncNeeded?: (roomId: string) => void; // ✅ 재연결 시 메시지 동기화 콜백
}

interface RealtimeChatHookReturn {
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  reconnect: () => void;
  cleanup: () => void;
}

export function useRealtimeChat({
  roomId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
  onSyncNeeded
}: RealtimeChatHookProps): RealtimeChatHookReturn {
  const { user } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // 채널 레퍼런스 관리
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>();
  const retryCountRef = useRef(0);

  // ✅ 100% Broadcast: WebSocket 상태 추적 (재연결 감지용)
  const previousStatusRef = useRef<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  // 메시지 중복 방지를 위한 처리된 메시지 ID 캐시
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // DELETE 이벤트 중복 방지를 위한 캐시
  const processedDeletesRef = useRef<Set<string>>(new Set());

  // 연결 정리 함수 (메모리 누수 방지 강화) - 채널 레지스트리 사용
  const cleanup = useCallback(async (roomId?: string | null) => {
    // 채널 정리
    if (channelRef.current && roomId) {
      const channelName = `room:${roomId}:messages`;
      await channelRegistry.releaseChannel(channelName);
      channelRef.current = null;
    }

    // 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // 상태 초기화
    setIsConnected(false);
    setConnectionState('disconnected');
    setError(null);

    // 메시지 캐시 정리 (메모리 관리)
    processedMessagesRef.current.clear();

    // DELETE 이벤트 캐시 정리
    processedDeletesRef.current.clear();

    // 재시도 카운터 초기화
    retryCountRef.current = 0;
  }, []);

  // 메시지 변경 핸들러
  const handleMessageChange = useCallback((
    payload: MessageChangePayload
  ) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        if (newRecord && onNewMessage) {
          // 임시 메시지(optimistic update)는 실시간으로 받은 실제 메시지로 교체되어야 함
          const messageId = newRecord.id;

          // 중복 방지 체크 - 이미 처리된 메시지는 무시
          if (processedMessagesRef.current.has(messageId)) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔄 Duplicate message filtered: ${messageId}`);
            }
            return;
          }

          processedMessagesRef.current.add(messageId);

          // 메모리 관리: 1000개 제한
          if (processedMessagesRef.current.size > 1000) {
            const messagesArray = Array.from(processedMessagesRef.current);
            const firstMessage = messagesArray[0];
            processedMessagesRef.current.delete(firstMessage);
          }

          if (process.env.NODE_ENV === 'development') {
            console.log(`📨 New realtime message received: ${messageId}`);
          }
          onNewMessage(newRecord);
        }
        break;

      case 'UPDATE':
        if (newRecord && onMessageUpdate) {
          onMessageUpdate(newRecord);
        }
        break;

      case 'DELETE':
        if (oldRecord?.id && onMessageDelete) {
          const messageId = oldRecord.id;

          // 중복 방지 체크 (Realtime DELETE + Custom Event 이중 처리 방지)
          if (processedDeletesRef.current.has(messageId)) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔄 Duplicate DELETE ignored: ${messageId}`);
            }
            return;
          }

          processedDeletesRef.current.add(messageId);
          onMessageDelete(messageId);

          // 메모리 관리: 5초 후 캐시에서 제거
          setTimeout(() => {
            processedDeletesRef.current.delete(messageId);
          }, 5000);
        }
        break;
    }
  }, [onNewMessage, onMessageUpdate, onMessageDelete]);

  // 채널 구독 함수
  const subscribeToRoom = useCallback(async (roomId: string) => {
    if (!user) {
      setError('사용자 인증이 필요합니다');
      return;
    }

    try {
      setConnectionState('connecting');
      setError(null);

      // Realtime 인증 설정 (최신 Supabase 버전에서 필요)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Realtime auth set for user: ${user.id}`);
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ No access token available for realtime auth`);
      }

      // ✅ 채널 레지스트리로 중복 구독 방지
      const channelName = `room:${roomId}:messages`;

      // 같은 roomId면 재구독 금지
      // @ts-ignore - topic is internal
      const currentTopic = (channelRef.current && (channelRef.current as any).topic) as string | undefined;
      if (currentTopic === channelName) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔁 Reuse existing realtime channel for same room');
        }
        setIsConnected(true);
        setConnectionState('connected');
        setError(null);
        return;
      }

      // 기존 채널 정리
      if (channelRef.current) {
        const prevTopic = currentTopic;
        if (prevTopic) {
          await channelRegistry.releaseChannel(prevTopic);
        }
        channelRef.current = null;
      }

      // ✅ 채널 레지스트리에서 채널 가져오기 (중복 방지)
      const channelInfo = channelRegistry.getChannelInfo(channelName);
      const isExistingChannel = channelInfo.exists;

      const nextChannel = await channelRegistry.getOrCreateChannel(channelName, {
        broadcast: { self: false }, // 자신의 메시지는 받지 않음
        presence: { key: user.id }
      });

      // ✅ 새로 생성된 채널에만 이벤트 리스너 등록 (중복 방지)
      if (!isExistingChannel) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🎧 [Room ${roomId}] Registering event listeners for new channel`);
        }

        nextChannel
          // Broadcast 리스너: 새 메시지
          .on('broadcast', { event: 'new_message' }, (payload) => {
            const message = payload.payload;
            if (process.env.NODE_ENV === 'development') {
              console.log(`📡 Broadcast new_message received: ${message.id}`);
            }

            // 메시지 변경 핸들러 형식으로 변환
            handleMessageChange({
              eventType: 'INSERT',
              new: message,
              old: {},
              schema: 'public',
              table: 'chat_messages',
              commit_timestamp: new Date().toISOString(),
              errors: null
            } as any);
          })
          // Broadcast 리스너: 메시지 업데이트
          .on('broadcast', { event: 'update_message' }, (payload) => {
            const message = payload.payload;
            if (process.env.NODE_ENV === 'development') {
              console.log(`📡 Broadcast update_message received: ${message.id}`);
            }

            handleMessageChange({
              eventType: 'UPDATE',
              new: message,
              old: {},
              schema: 'public',
              table: 'chat_messages',
              commit_timestamp: new Date().toISOString(),
              errors: null
            } as any);
          })
          // Broadcast 리스너: 메시지 삭제
          .on('broadcast', { event: 'delete_message' }, (payload) => {
            const { message_id } = payload.payload;
            if (process.env.NODE_ENV === 'development') {
              console.log(`📡 Broadcast delete_message received: ${message_id}`);
            }

            handleMessageChange({
              eventType: 'DELETE',
              new: {},
              old: { id: message_id },
              schema: 'public',
              table: 'chat_messages',
              commit_timestamp: new Date().toISOString(),
              errors: null
            } as any);
          })
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              const wasDisconnected = previousStatusRef.current === 'disconnected' || previousStatusRef.current === 'error';

              setIsConnected(true);
              setConnectionState('connected');
              setError(null);

              // ✅ 100% Broadcast: 재연결 감지 및 동기화 트리거
              // 조건: (1) 이전에 연결 끊김 OR (2) 재시도 카운트 > 0
              if ((wasDisconnected || retryCountRef.current > 0) && onSyncNeeded) {
                if (process.env.NODE_ENV === 'development') {
                  console.log(`🔄 Broadcast reconnected (${previousStatusRef.current} → connected), syncing messages for room: ${roomId}`);
                }
                onSyncNeeded(roomId);
              }

              previousStatusRef.current = 'connected';
              retryCountRef.current = 0;
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ Broadcast channel SUBSCRIBED for room: ${roomId}`);
              }
            } else if (status === 'CHANNEL_ERROR') {
              previousStatusRef.current = 'error';
              setIsConnected(false);
              setConnectionState('error');
              setError(err?.message || '채널 연결 오류');
              if (process.env.NODE_ENV === 'development') {
                console.error('❌ Broadcast channel error:', { roomId, err });
              }
            } else if (status === 'TIMED_OUT') {
              previousStatusRef.current = 'error';
              setIsConnected(false);
              setConnectionState('error');
              setError('연결 시간 초과');
              if (process.env.NODE_ENV === 'development') {
                console.error('⏰ Broadcast connection timed out:', { roomId });
              }
            } else if (status === 'CLOSED') {
              previousStatusRef.current = 'disconnected';
              setIsConnected(false);
              setConnectionState('disconnected');
              if (process.env.NODE_ENV === 'development') {
                console.warn('🔌 Broadcast connection closed:', { roomId });
              }
            }
          });
      } else {
        // ✅ 기존 채널 재사용 - 리스너 등록 없이 상태만 업데이트
        setIsConnected(true);
        setConnectionState('connected');
        setError(null);
        if (process.env.NODE_ENV === 'development') {
          console.log(`♻️ [Room ${roomId}] Reusing existing channel, skipping listener registration`);
        }
      }

      // 새 채널 설정
      channelRef.current = nextChannel;

    } catch (error) {
      setConnectionState('error');
      setError(error instanceof Error ? error.message : '알 수 없는 오류');
      console.error('❌ Failed to subscribe to realtime:', error);
    }
  }, [user, handleMessageChange]);

  // 재연결 함수 (지수 백오프)
  const reconnect = useCallback(() => {
    if (!roomId) return;

    const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
    retryCountRef.current += 1;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Reconnecting in ${retryDelay}ms (attempt ${retryCountRef.current})`);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      subscribeToRoom(roomId);
    }, retryDelay);
  }, [roomId, subscribeToRoom]);

  // 방 변경 시 구독 설정
  useEffect(() => {
    if (roomId && user) {
      subscribeToRoom(roomId);
    } else {
      cleanup(roomId);
    }

    return () => cleanup(roomId);
  }, [roomId, user, subscribeToRoom, cleanup]);

  // 연결 오류 시 자동 재연결
  useEffect(() => {
    if (connectionState === 'error' && roomId && retryCountRef.current < 5) {
      reconnect();
    }
  }, [connectionState, roomId, reconnect]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => cleanup(roomId);
  }, [cleanup, roomId]);

  return {
    isConnected,
    connectionState,
    error,
    reconnect,
    cleanup
  };
}

// 타이핑 상태 관리를 위한 별도 훅
interface TypingIndicatorProps {
  roomId: string | null;
}

export function useTypingIndicator({ roomId }: TypingIndicatorProps) {
  const { user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingChannel, setTypingChannel] = useState<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();


  // 타이핑 시작
  const startTyping = useCallback(async () => {
    if (!typingChannel || !user || !roomId) return;

    try {
      await typingChannel.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: { user_id: user.id, username: user.username }
      });
    } catch (error) {
      console.error('Failed to send typing start:', error);
    }
  }, [typingChannel, user, roomId]);

  // 타이핑 중지
  const stopTyping = useCallback(async () => {
    if (!typingChannel || !user || !roomId) return;

    try {
      await typingChannel.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: { user_id: user.id }
      });
    } catch (error) {
      console.error('Failed to send typing stop:', error);
    }
  }, [typingChannel, user, roomId]);

  // 타이핑 상태 업데이트 (2초 후 자동 중지)
  const updateTyping = useCallback(() => {
    startTyping();

    // 이전 타이머 취소
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // 2초 후 타이핑 중지
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [startTyping, stopTyping]);

  // 타이핑 채널 설정
  useEffect(() => {
    if (!roomId || !user) {
      setTypingChannel(null);
      setTypingUsers(new Set()); // 채널이 없으면 타이핑 사용자 초기화
      return;
    }

    const channel = supabase
      .channel(`room:${roomId}:typing`)
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        const { user_id } = payload.payload;
        if (user_id !== user.id) {
          setTypingUsers(prev => new Set([...prev, user_id]));
        }
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        const { user_id } = payload.payload;
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(user_id);
          return next;
        });
      })
      .subscribe();

    setTypingChannel(channel);

    return () => {
      // 타이머 정리
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = undefined;
      }

      // 채널 정리 (정리 시에는 브로드캐스트를 보내지 않음)
      supabase.removeChannel(channel);

      // 상태 초기화
      setTypingUsers(new Set());
      setTypingChannel(null);
    };
  }, [roomId, user]);

  // React 19 최적화: useMemo로 타이핑 사용자 배열 메모이제이션
  const typingUsersArray = useMemo(() => Array.from(typingUsers), [typingUsers]);

  return {
    typingUsers: typingUsersArray,
    updateTyping,
    startTyping,
    stopTyping
  };
}
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ChatMessage } from "@/types/chat";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// 기존 프로젝트의 Supabase 클라이언트 사용 (중복 인스턴스 방지)
const supabase = createSupabaseBrowserClient();

interface RealtimeChatHookProps {
  roomId: string | null;
  onNewMessage?: (message: ChatMessage) => void;
  onMessageUpdate?: (message: ChatMessage) => void;
  onMessageDelete?: (messageId: string) => void;
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
  onMessageDelete
}: RealtimeChatHookProps): RealtimeChatHookReturn {
  const { user } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // 채널 레퍼런스 관리
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);

  // 메시지 중복 방지를 위한 처리된 메시지 ID 캐시
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // 연결 정리 함수
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setIsConnected(false);
    setConnectionState('disconnected');
    setError(null);

    // 메시지 캐시 정리 (메모리 관리)
    processedMessagesRef.current.clear();
  }, []);

  // 메시지 변경 핸들러
  const handleMessageChange = useCallback((
    payload: RealtimePostgresChangesPayload<ChatMessage>
  ) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        if (newRecord && onNewMessage) {
          // 임시 메시지(optimistic update)는 실시간으로 받은 실제 메시지로 교체되어야 함
          const messageId = newRecord.id;

          // 중복 방지 체크 - 이미 처리된 메시지는 무시
          if (processedMessagesRef.current.has(messageId)) {
            console.log(`🔄 Duplicate message filtered: ${messageId}`);
            return;
          }

          processedMessagesRef.current.add(messageId);

          // 메모리 관리: 1000개 제한
          if (processedMessagesRef.current.size > 1000) {
            const messagesArray = Array.from(processedMessagesRef.current);
            const firstMessage = messagesArray[0];
            processedMessagesRef.current.delete(firstMessage);
          }

          console.log(`📨 New realtime message received: ${messageId}`, newRecord);
          onNewMessage(newRecord);
        }
        break;

      case 'UPDATE':
        if (newRecord && onMessageUpdate) {
          onMessageUpdate(newRecord);
        }
        break;

      case 'DELETE':
        if (oldRecord && onMessageDelete) {
          onMessageDelete(oldRecord.id);
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
      console.log(`🔐 Setting up realtime auth for user: ${user.id}`);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
        console.log(`✅ Realtime auth set with token`);
      } else {
        console.warn(`⚠️ No access token available for realtime auth`);
      }

      // 기존 채널 정리
      if (channelRef.current) {
        console.log(`🧹 Cleaning up previous channel for room: ${roomId}`);
        supabase.removeChannel(channelRef.current);
      }

      // 새 채널 생성 및 구독 (단순한 방식으로)
      console.log(`🔧 Setting up postgres_changes subscription for room: ${roomId}`);
      const channel = supabase
        .channel(`room:${roomId}:messages`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            console.log(`🔥 Raw postgres_changes event received for room ${roomId}:`, payload);
            handleMessageChange(payload);
          }
        )
        .subscribe((status, err) => {
          console.log(`🔗 Realtime connection status change: ${status}`, {
            roomId,
            channelName: `room:${roomId}:messages`,
            timestamp: new Date().toISOString(),
            err
          });

          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setConnectionState('connected');
            setError(null);
            retryCountRef.current = 0;
            console.log(`✅ Realtime postgres_changes SUBSCRIBED for room: ${roomId}`, {
              channelName: `room:${roomId}:messages`,
              table: 'chat_messages',
              filter: `room_id=eq.${roomId}`,
              isConnected: true,
              timestamp: new Date().toISOString()
            });

            // 구독 성공 후 테스트 메시지 확인
            console.log(`🔍 Now listening for postgres_changes on chat_messages table with filter: room_id=eq.${roomId}`);

          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            setConnectionState('error');
            setError(err?.message || '채널 연결 오류');
            console.error('❌ Realtime channel error:', {
              roomId,
              channelName: `room:${roomId}:messages`,
              err,
              possibleCauses: [
                'RLS policies missing',
                'Invalid room_id',
                'Authentication issues',
                'Table not in realtime publication'
              ]
            });
          } else if (status === 'TIMED_OUT') {
            setIsConnected(false);
            setConnectionState('error');
            setError('연결 시간 초과');
            console.error('⏰ Realtime connection timed out:', { roomId });
          } else if (status === 'CLOSED') {
            setIsConnected(false);
            setConnectionState('disconnected');
            console.warn('🔌 Realtime connection closed:', { roomId });
          } else {
            console.log(`📊 Realtime status: ${status}`, { roomId, timestamp: new Date().toISOString() });
          }
        });

      channelRef.current = channel;

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

    console.log(`🔄 Reconnecting in ${retryDelay}ms (attempt ${retryCountRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      subscribeToRoom(roomId);
    }, retryDelay);
  }, [roomId, subscribeToRoom]);

  // 방 변경 시 구독 설정
  useEffect(() => {
    if (roomId && user) {
      subscribeToRoom(roomId);
    } else {
      cleanup();
    }

    return cleanup;
  }, [roomId, user, subscribeToRoom, cleanup]);

  // 연결 오류 시 자동 재연결
  useEffect(() => {
    if (connectionState === 'error' && roomId && retryCountRef.current < 5) {
      reconnect();
    }
  }, [connectionState, roomId, reconnect]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

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
  onTypingUpdate?: (typingUsers: string[]) => void;
}

export function useTypingIndicator({ roomId, onTypingUpdate }: TypingIndicatorProps) {
  const { user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingChannel, setTypingChannel] = useState<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // 타이핑 상태 변경 시 콜백 호출 (별도 useEffect로 분리)
  useEffect(() => {
    if (onTypingUpdate) {
      onTypingUpdate(Array.from(typingUsers));
    }
  }, [typingUsers, onTypingUpdate]);

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
        console.log(`⌨️ User started typing: ${user_id}`, { roomId, currentUser: user.id });
        if (user_id !== user.id) {
          setTypingUsers(prev => new Set([...prev, user_id]));
        }
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        const { user_id } = payload.payload;
        console.log(`⌨️ User stopped typing: ${user_id}`, { roomId });
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(user_id);
          return next;
        });
      })
      .subscribe((status) => {
        console.log(`⌨️ Typing channel status: ${status}`, { roomId });
      });

    setTypingChannel(channel);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // 정리 시에는 브로드캐스트를 보내지 않음 (이미 연결이 끊어졌을 수 있음)
      supabase.removeChannel(channel);
    };
  }, [roomId, user]); // onTypingUpdate, stopTyping 제거

  return {
    typingUsers: Array.from(typingUsers),
    updateTyping,
    startTyping,
    stopTyping
  };
}
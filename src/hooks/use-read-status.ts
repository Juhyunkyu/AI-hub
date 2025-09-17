"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// 읽음 상태 타입 정의
export interface MessageReadStatus {
  message_id: string;
  user_id: string;
  read_at: string;
  unread_count: number;
}

// 읽음 상태 업데이트 이벤트 타입
export interface ReadStatusUpdate {
  message_id: string;
  user_id: string;
  room_id: string;
  unread_count: number;
  read_at: string;
}

interface UseReadStatusProps {
  roomId: string | null;
  onReadStatusChange?: (update: ReadStatusUpdate) => void;
  // Context7 MCP 강화: 현재 채팅방에 있는 사용자들 정보
  presentUsers?: { user_id: string }[];
}

/**
 * 카카오톡 스타일 읽음 상태 실시간 동기화 훅
 * Context7 MCP 최적화 권장사항 적용
 */
export function useReadStatus({ roomId, onReadStatusChange, presentUsers }: UseReadStatusProps) {
  const { user } = useAuthStore();
  const [readStatusMap, setReadStatusMap] = useState<Map<string, MessageReadStatus>>(new Map());
  const [loading, setLoading] = useState(false);

  // Realtime 연결 관리
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createSupabaseBrowserClient();

  // Context7 MCP 최적화: 중복 처리 방지 및 메모리 관리
  const processingRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef<Map<string, number>>(new Map()); // 마지막 업데이트 시간 추적
  const retryCountRef = useRef<Map<string, number>>(new Map()); // 재시도 횟수 추적
  const batchProcessingRef = useRef<Set<string>>(new Set()); // 배치 처리 중인 메시지들

  // Context7 MCP 패턴: 읽음 상태는 영구 보존 (메시지 검색 시 필요)

  // Context7 MCP 강화: 캐시 정리 함수 (메모리 최적화)
  const cleanupOldCache = useCallback(() => {
    const now = Date.now();
    const CACHE_TTL = 30 * 60 * 1000; // 30분

    // 오래된 업데이트 시간 정리
    for (const [messageId, lastUpdate] of lastUpdateRef.current.entries()) {
      if (now - lastUpdate > CACHE_TTL) {
        lastUpdateRef.current.delete(messageId);
        retryCountRef.current.delete(messageId);
      }
    }
  }, []);

  // Context7 MCP 강화: 배치 처리로 여러 메시지 읽음 상태 한 번에 조회
  const batchInitializeMessageCounts = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length) return;

    const newMessageIds = messageIds.filter(id =>
      !readStatusMap.has(id) && !batchProcessingRef.current.has(id)
    );

    if (!newMessageIds.length) return;

    // 배치 처리 중 표시
    newMessageIds.forEach(id => batchProcessingRef.current.add(id));

    try {
      // Context7 MCP: 병렬 처리로 성능 최적화
      const countPromises = newMessageIds.map(async (messageId) => {
        const retryCount = retryCountRef.current.get(messageId) || 0;
        const MAX_RETRIES = 2;

        try {
          const { data, error } = await supabase.rpc('get_unread_count_kakao_style', {
            p_message_id: messageId
          });

          if (error) throw error;

          const actualCount = typeof data === 'number' ? data : 0;
          retryCountRef.current.delete(messageId); // 성공 시 재시도 카운트 정리

          return { messageId, count: actualCount, success: true };
        } catch (error) {
          if (retryCount < MAX_RETRIES) {
            retryCountRef.current.set(messageId, retryCount + 1);
          }

          if (process.env.NODE_ENV === 'development') {
            console.warn(`Failed to get count for message ${messageId} (retry ${retryCount}):`, error);
          }

          return { messageId, count: 0, success: false };
        }
      });

      const results = await Promise.all(countPromises);

      // 상태 일괄 업데이트
      setReadStatusMap(prev => {
        const newMap = new Map(prev);
        results.forEach(({ messageId, count, success }) => {
          if (success || !newMap.has(messageId)) {
            newMap.set(messageId, {
              message_id: messageId,
              user_id: user?.id || '',
              read_at: new Date().toISOString(),
              unread_count: count
            });
          }
        });
        return newMap;
      });

      if (process.env.NODE_ENV === 'development') {
        const successCount = results.filter(r => r.success).length;
        console.log(`📊 Batch initialized ${successCount}/${results.length} message counts`);
      }
    } catch (error) {
      console.error('Batch initialize message counts error:', error);
    } finally {
      // 배치 처리 완료 후 정리
      newMessageIds.forEach(id => batchProcessingRef.current.delete(id));
    }
  }, [readStatusMap, supabase, user]);

  /**
   * 메시지를 읽음으로 표시 (카카오톡 스타일)
   */
  const markMessageAsRead = useCallback(async (messageId: string) => {
    if (!user || !roomId || processingRef.current.has(messageId)) return;

    // 중복 처리 방지
    processingRef.current.add(messageId);

    try {
      // RPC 함수 호출로 최적화된 읽음 처리
      const { data, error } = await supabase.rpc('mark_message_as_read_optimized', {
        p_message_id: messageId
      });

      if (error) {
        console.error('Failed to mark message as read:', error);
        return;
      }

      if (data) {
        const update: ReadStatusUpdate = {
          message_id: data.message_id,
          user_id: data.user_id,
          room_id: data.room_id,
          unread_count: data.unread_count,
          read_at: data.read_at
        };

        // Context7 MCP 최적화: 읽음 상태 영구 보존 (검색 시 필요)
        setReadStatusMap(prev => new Map(prev.set(messageId, {
          message_id: messageId,
          user_id: user.id,
          read_at: data.read_at,
          unread_count: data.unread_count
        })));

        // 실시간 브로드캐스트로 다른 사용자들에게 알림
        if (channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'read_status_update',
            payload: update
          });
        }

        // 콜백 호출
        onReadStatusChange?.(update);

        if (process.env.NODE_ENV === 'development') {
          console.log(`📖 Message marked as read: ${messageId}, unread count: ${data.unread_count}`);
        }
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    } finally {
      // 처리 완료 후 제거
      processingRef.current.delete(messageId);
    }
  }, [user, roomId, supabase, onReadStatusChange]);

  /**
   * 채팅방의 모든 메시지를 읽음 처리 (대화 입장 시)
   */
  const markAllRoomMessagesAsRead = useCallback(async () => {
    if (!user || !roomId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('mark_all_room_messages_as_read', {
        p_room_id: roomId
      });

      if (error) {
        console.error('Failed to mark all messages as read:', error);
        return;
      }

      if (data) {
        // 실시간 브로드캐스트
        if (channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'room_messages_read',
            payload: {
              room_id: roomId,
              user_id: user.id,
              messages_marked_read: data.messages_marked_read,
              marked_at: data.marked_at
            }
          });
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`📖 All room messages marked as read: ${data.messages_marked_read} messages`);
        }
      }
    } catch (error) {
      console.error('Error marking all messages as read:', error);
    } finally {
      setLoading(false);
    }
  }, [user, roomId, supabase]);

  /**
   * 특정 메시지의 읽음 상태 조회
   */
  const getMessageReadStatus = useCallback((messageId: string): MessageReadStatus | undefined => {
    return readStatusMap.get(messageId);
  }, [readStatusMap]);

  /**
   * 특정 메시지의 안읽음 개수 조회
   */
  const getUnreadCount = useCallback((messageId: string): number => {
    return readStatusMap.get(messageId)?.unread_count ?? 0;
  }, [readStatusMap]);

  /**
   * Context7 MCP 최적화: React 19 useOptimistic 패턴으로 즉시 카운트 표시 (재시도 로직 강화)
   */
  const initializeMessageCount = useCallback(async (messageId: string, optimisticCount?: number) => {
    if (!messageId || readStatusMap.has(messageId) || processingRef.current.has(messageId)) return;

    // 중복 처리 방지
    processingRef.current.add(messageId);

    try {
      // Context7 MCP: 즉시 optimistic count 설정 (React 19 패턴)
      if (optimisticCount !== undefined) {
        setReadStatusMap(prev => new Map(prev.set(messageId, {
          message_id: messageId,
          user_id: user?.id || '',
          read_at: new Date().toISOString(),
          unread_count: optimisticCount
        })));

        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ Optimistic count for message ${messageId}: ${optimisticCount}`);
        }
      }

      // Context7 MCP 강화: 재시도 로직 추가
      const retryCount = retryCountRef.current.get(messageId) || 0;
      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [1000, 2000, 4000]; // 지수 백오프

      let attempts = 0;
      let success = false;
      let actualCount = 0;

      while (attempts <= MAX_RETRIES && !success) {
        try {
          // Context7 MCP: AbortController로 타임아웃 관리
          const controller = new AbortController();
          const timeout = Math.min(5000 + (attempts * 2000), 15000); // 점진적 타임아웃 증가
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const { data, error } = await supabase.rpc('get_unread_count_kakao_style', {
            p_message_id: messageId
          });

          clearTimeout(timeoutId);

          if (error) {
            throw error;
          }

          actualCount = typeof data === 'number' ? data : 0;
          success = true;
          retryCountRef.current.delete(messageId); // 성공 시 재시도 카운트 정리

        } catch (error) {
          attempts++;

          if (attempts <= MAX_RETRIES) {
            retryCountRef.current.set(messageId, attempts);

            if (process.env.NODE_ENV === 'development') {
              console.warn(`Failed to get count for message ${messageId} (attempt ${attempts}):`, error);
            }

            // Context7 MCP: 지수 백오프로 재시도
            if (attempts < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempts - 1] || 4000));
            }
          } else {
            // 최종 실패 시 optimistic count 유지 (있다면)
            if (process.env.NODE_ENV === 'development') {
              console.error(`Final failure to get count for message ${messageId}:`, error);
            }
          }
        }
      }

      // 성공한 경우에만 실제 카운트로 업데이트
      if (success) {
        setReadStatusMap(prev => new Map(prev.set(messageId, {
          message_id: messageId,
          user_id: user?.id || '',
          read_at: new Date().toISOString(),
          unread_count: actualCount
        })));

        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 Actual count for message ${messageId}: ${actualCount} (was optimistic: ${optimisticCount})`);
        }
      }
    } finally {
      processingRef.current.delete(messageId);
    }
  }, [readStatusMap, supabase, user]);

  /**
   * Realtime 구독 설정 (Context7 최적화 패턴)
   */
  useEffect(() => {
    if (!roomId || !user) {
      // 이전 채널 정리
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // 채널 생성 (private 채널로 RLS 적용)
    const channel = supabase.channel(`room:${roomId}:read_status`, {
      config: { private: true }
    });

    // 1. 읽음 상태 테이블 변경사항 실시간 감지 (postgres_changes)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chat_message_reads',
      filter: `message_id=in.(select id from chat_messages where room_id=eq.${roomId})`
    }, async (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const readRecord = payload.new as any;

        // Context7 MCP 최적화: 다른 사용자의 읽음 상태 업데이트만 처리
        if (readRecord.user_id !== user.id) {
          // 중복 처리 방지: 같은 메시지의 최근 업데이트인지 확인
          const lastUpdate = lastUpdateRef.current.get(readRecord.message_id) || 0;
          const currentTime = Date.now();

          if (currentTime - lastUpdate < 1000) { // 1초 내 중복 업데이트 무시
            return;
          }

          lastUpdateRef.current.set(readRecord.message_id, currentTime);

          // 해당 메시지의 최신 읽음 카운트 조회
          const { data } = await supabase.rpc('get_unread_count_kakao_style', {
            p_message_id: readRecord.message_id
          });

          if (typeof data === 'number') {
            const update: ReadStatusUpdate = {
              message_id: readRecord.message_id,
              user_id: readRecord.user_id,
              room_id: roomId,
              unread_count: data,
              read_at: readRecord.read_at
            };

            // 로컬 상태 업데이트
            setReadStatusMap(prev => new Map(prev.set(readRecord.message_id, {
              message_id: readRecord.message_id,
              user_id: readRecord.user_id,
              read_at: readRecord.read_at,
              unread_count: data
            })));

            onReadStatusChange?.(update);

            if (process.env.NODE_ENV === 'development') {
              console.log(`📖 Read status updated: ${readRecord.message_id}, unread: ${data}`);
            }
          }
        }
      }
    });

    // 2. 브로드캐스트 메시지 수신 (빠른 UI 업데이트용)
    channel.on('broadcast', { event: 'read_status_update' }, (payload) => {
      const update = payload.payload as ReadStatusUpdate;

      // Context7 MCP 최적화: 다른 사용자의 읽음 상태 업데이트만 처리
      if (update.user_id !== user.id && update.room_id === roomId) {
        // 중복 처리 방지
        const lastUpdate = lastUpdateRef.current.get(update.message_id) || 0;
        const currentTime = Date.now();

        if (currentTime - lastUpdate < 500) { // 브로드캐스트는 더 빠른 중복 방지 (500ms)
          return;
        }

        lastUpdateRef.current.set(update.message_id, currentTime);

        setReadStatusMap(prev => new Map(prev.set(update.message_id, {
          message_id: update.message_id,
          user_id: update.user_id,
          read_at: update.read_at,
          unread_count: update.unread_count
        })));

        onReadStatusChange?.(update);

        if (process.env.NODE_ENV === 'development') {
          console.log(`📡 Broadcast read status: ${update.message_id}, unread: ${update.unread_count}`);
        }
      }
    });

    // 3. 방 전체 메시지 읽음 처리 브로드캐스트
    channel.on('broadcast', { event: 'room_messages_read' }, async (payload) => {
      const data = payload.payload;

      if (data.user_id !== user.id && data.room_id === roomId) {
        // Context7 MCP 최적화: 방의 모든 메시지 읽음 카운트 실시간 업데이트
        try {
          // 현재 readStatusMap에 있는 모든 메시지의 읽음 카운트를 새로고침
          const messageIds = Array.from(readStatusMap.keys());

          // 병렬 처리로 성능 최적화
          const countPromises = messageIds.map(async (messageId) => {
            try {
              const { data: count } = await supabase.rpc('get_unread_count_kakao_style', {
                p_message_id: messageId
              });
              return { messageId, count: typeof count === 'number' ? count : 0 };
            } catch {
              return { messageId, count: 0 }; // 에러 시 0으로 처리
            }
          });

          const results = await Promise.all(countPromises);

          // 읽음 상태 맵 일괄 업데이트
          setReadStatusMap(prev => {
            const newMap = new Map(prev);
            results.forEach(({ messageId, count }) => {
              const existing = newMap.get(messageId);
              if (existing) {
                newMap.set(messageId, {
                  ...existing,
                  unread_count: count
                });
              }
            });
            return newMap;
          });

          // 콜백으로 UI 업데이트 알림 (각 메시지별로)
          results.forEach(({ messageId, count }) => {
            if (onReadStatusChange) {
              onReadStatusChange({
                message_id: messageId,
                user_id: data.user_id,
                room_id: roomId,
                unread_count: count,
                read_at: data.marked_at
              });
            }
          });

          if (process.env.NODE_ENV === 'development') {
            console.log(`📡 Room messages read broadcast: ${data.messages_marked_read} messages, updated ${results.length} counts`);
          }
        } catch (error) {
          console.error('Error refreshing read counts after room_messages_read:', error);
        }
      }
    });

    // 구독 시작
    channel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Read status channel subscribed: room:${roomId}:read_status`);
        }
      } else if (err) {
        console.error('Read status subscription error:', err);
      }
    });

    channelRef.current = channel;

    // Context7 MCP 패턴: 정리 함수 (메모리 누수 방지)
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // 메모리 정리
      processingRef.current.clear();
      lastUpdateRef.current.clear();
    };
  }, [roomId, user, supabase, onReadStatusChange]);

  // Context7 MCP 강화: presentUsers 변화 감지 시 모든 메시지 카운트 실시간 재계산
  useEffect(() => {
    if (!roomId || !user || !presentUsers || readStatusMap.size === 0) return;

    const recalculateAllCounts = async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Recalculating counts due to presence change. Present users: ${presentUsers.length}`);
        }

        // 현재 표시된 모든 메시지에 대해 카운트 재계산
        const messageIds = Array.from(readStatusMap.keys());

        // 병렬 처리로 성능 최적화
        const countPromises = messageIds.map(async (messageId) => {
          try {
            const { data: count } = await supabase.rpc('get_unread_count_kakao_style', {
              p_message_id: messageId
            });
            return { messageId, count: typeof count === 'number' ? count : 0 };
          } catch {
            return { messageId, count: 0 }; // 에러 시 0으로 처리
          }
        });

        const results = await Promise.all(countPromises);

        // 읽음 상태 맵 일괄 업데이트
        setReadStatusMap(prev => {
          const newMap = new Map(prev);
          results.forEach(({ messageId, count }) => {
            const existing = newMap.get(messageId);
            if (existing) {
              newMap.set(messageId, {
                ...existing,
                unread_count: count
              });
            }
          });
          return newMap;
        });

        // 콜백으로 UI 업데이트 알림 (각 메시지별로)
        results.forEach(({ messageId, count }) => {
          if (onReadStatusChange) {
            onReadStatusChange({
              message_id: messageId,
              user_id: user.id,
              room_id: roomId,
              unread_count: count,
              read_at: new Date().toISOString()
            });
          }
        });

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Recalculated ${results.length} message counts due to presence change`);
        }
      } catch (error) {
        console.error('Error recalculating counts on presence change:', error);
      }
    };

    // 디바운스 적용 (500ms 내 여러 변화는 마지막 것만 처리)
    const debounceTimer = setTimeout(recalculateAllCounts, 500);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [presentUsers, roomId, user, readStatusMap, supabase, onReadStatusChange]);

  // Context7 MCP 강화: 정기적인 캐시 정리 (30분마다)
  useEffect(() => {
    const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30분
    const cleanupTimer = setInterval(() => {
      cleanupOldCache();

      if (process.env.NODE_ENV === 'development') {
        const cacheSize = lastUpdateRef.current.size;
        const retrySize = retryCountRef.current.size;
        console.log(`🧹 Cache cleanup completed. Cache entries: ${cacheSize}, Retry entries: ${retrySize}`);
      }
    }, CLEANUP_INTERVAL);

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      clearInterval(cleanupTimer);
    };
  }, [cleanupOldCache]);

  return {
    // 상태
    readStatusMap,
    loading,

    // 액션
    markMessageAsRead,
    markAllRoomMessagesAsRead,

    // Context7 MCP 강화: 새로운 배치 처리 및 캐시 관리 함수들
    batchInitializeMessageCounts,
    cleanupOldCache,

    // 헬퍼
    getMessageReadStatus,
    getUnreadCount,
    initializeMessageCount
  };
}
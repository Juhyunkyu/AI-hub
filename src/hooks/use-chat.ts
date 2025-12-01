"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { ChatMessage, ChatRoomWithParticipants } from "@/types/chat";
import { toast } from "sonner";
import { useRealtimeChat, useTypingIndicator } from "./use-realtime-chat";
import { useGlobalChatRoomsSubscription } from "./use-global-chat-rooms-subscription";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

// Supabase 클라이언트 (Broadcast용)
const supabase = createSupabaseBrowserClient();

// 채팅방 정렬 헬퍼 함수 (React 19에서는 함수 컴포넌트 외부로 이동하여 불필요한 재생성 방지)
const sortRoomsByLastMessage = (rooms: ChatRoomWithParticipants[]) => {
  return [...rooms].sort((a, b) => {
    // 마지막 메시지가 있으면 해당 시간, 없으면 채팅방 생성 시간 사용
    const aTime = a.last_message?.created_at || a.updated_at || a.created_at;
    const bTime = b.last_message?.created_at || b.updated_at || b.created_at;

    // 최신 시간이 위로 오도록 정렬 (내림차순)
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
};

// 메시지 찾기 헬퍼 함수 (React 19 + Context7 Pattern)
// tempId 기반 정확한 매칭 - 시간 제약 없음 (큰 파일 업로드도 안전)
const findTempMessage = (messages: ChatMessage[], targetMessage: ChatMessage) => {
  return messages.findIndex(m => {
    // tempId가 있으면 정확히 매칭 (가장 안전한 방법)
    if (m.tempId && targetMessage.tempId) {
      return m.tempId === targetMessage.tempId;
    }

    // tempId가 없는 레거시 메시지는 기존 로직 사용
    if (!m.id.startsWith('temp-')) return false;
    if (m.sender_id !== targetMessage.sender_id) return false;

    // 파일 업로드: file_name + 시간 체크 (30초 window)
    if (targetMessage.file_name && m.file_name) {
      if (m.file_name !== targetMessage.file_name) return false;
      const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(targetMessage.created_at).getTime());
      return timeDiff < 30000;
    }

    // 텍스트 메시지: content + 시간 체크 (10초 window)
    if (m.content === targetMessage.content) {
      const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(targetMessage.created_at).getTime());
      return timeDiff < 10000;
    }

    return false;
  });
};

// 이미지 파일인지 판단하는 헬퍼 함수
const isImageFile = (file: File): boolean => {
  // MIME 타입으로 판단
  if (file.type.startsWith('image/')) {
    return true;
  }

  // 확장자로도 판단 (fallback)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const fileName = file.name.toLowerCase();
  return imageExtensions.some(ext => fileName.endsWith(ext));
};

// 파일 타입 결정 함수
const getMessageType = (file?: File): "text" | "file" | "image" => {
  if (!file) return "text";
  return isImageFile(file) ? "image" : "file";
};

export function useChatHook() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [rooms, setRooms] = useState<ChatRoomWithParticipants[]>([]);
  const [currentRoom, setCurrentRoom] =
    useState<ChatRoomWithParticipants | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // React 19 + Context7 Pattern: 중복 메시지 처리 방지 (batching 대응)
  const processingMessagesRef = useRef<Set<string>>(new Set());
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // ✅ Broadcast 채널 캐시 (중복 구독 방지)
  const broadcastChannelCacheRef = useRef<Map<string, RealtimeChannel>>(new Map());

  // ✅ syncMessages 경쟁 조건 방지용 refs
  const syncLockRef = useRef<boolean>(false);
  const syncVersionRef = useRef<number>(0);

  // 실시간 메시지 핸들러들 (React 19 최적화)
  const handleNewRealtimeMessage = useCallback((message: ChatMessage) => {
    // Guard 1: 이미 처리 완료된 메시지는 무시 (영구 캐시)
    if (processedMessagesRef.current.has(message.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Already processed message ignored: ${message.id}`);
      }
      return;
    }

    // Guard 2: 이미 처리 중인 메시지는 무시 (React batching 중복 방지)
    if (processingMessagesRef.current.has(message.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Duplicate realtime message ignored (processing): ${message.id}`);
      }
      return;
    }

    // 처리 시작 표시
    processingMessagesRef.current.add(message.id);
    processedMessagesRef.current.add(message.id);

    // ✅ 메모리 관리: 1000개 제한 (최적화: O(1) 복잡도)
    if (processedMessagesRef.current.size > 1000) {
      // Set.prototype.values().next()로 첫 번째 요소만 O(1)로 가져옴
      // 기존: Array.from() → O(n) 메모리 할당 + O(n) 복사
      const firstId = processedMessagesRef.current.values().next().value;
      if (firstId) {
        processedMessagesRef.current.delete(firstId);
      }
    }

    setMessages(prev => {
      // 임시 메시지 찾기 (헬퍼 함수 사용)
      const tempMessageIndex = findTempMessage(prev, message);

      // 임시 메시지가 있으면 교체
      if (tempMessageIndex !== -1) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Replacing optimistic message with real message: ${message.id}`);
        }
        const newMessages = [...prev];
        newMessages[tempMessageIndex] = {
          ...message,
          sender: message.sender || prev[tempMessageIndex].sender
        };
        return newMessages;
      }

      // 이미 실제 메시지가 있는지 확인
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }

      // sender 정보 보강 (currentRoom이 있을 때만)
      const enrichedMessage = currentRoom && !message.sender
        ? (() => {
            const senderParticipant = currentRoom.participants.find(
              p => p.user_id === message.sender_id || p.user?.id === message.sender_id
            );
            return senderParticipant?.user ? {
              ...message,
              sender: {
                id: senderParticipant.user.id,
                username: senderParticipant.user.username || "Unknown",
                avatar_url: senderParticipant.user.avatar_url
              }
            } : message;
          })()
        : message;

      return [...prev, enrichedMessage];
    });

    // 채팅방 리스트의 최근 메시지도 업데이트 (sender 정보 포함)
    setRooms(prev => {
      const updatedRooms = prev.map(room => {
        if (room.id === message.room_id) {
          // 최근 메시지에도 sender 정보 보강
          let enrichedLastMessage = message;
          if (!message.sender) {
            const senderParticipant = room.participants.find(
              p => p.user_id === message.sender_id || p.user?.id === message.sender_id
            );
            if (senderParticipant?.user) {
              enrichedLastMessage = {
                ...message,
                sender: {
                  id: senderParticipant.user.id,
                  username: senderParticipant.user.username || "Unknown",
                  avatar_url: senderParticipant.user.avatar_url
                }
              };
            }
          }
          return { ...room, last_message: enrichedLastMessage };
        }
        return room;
      });
      return sortRoomsByLastMessage(updatedRooms);
    });

    // 처리 중 플래그는 즉시 제거 (영구 캐시는 유지)
    processingMessagesRef.current.delete(message.id);
  }, [currentRoom]);

  const handleMessageUpdate = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      // 🔹 Soft Delete 처리: deleted_for 배열에 현재 사용자가 포함되어 있으면 메시지 제거
      if (message.deleted_for && user && message.deleted_for.includes(user.id)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🗑️ Message ${message.id} soft deleted for current user, removing from UI`);
        }
        return prev.filter(m => m.id !== message.id);
      }

      // 일반 업데이트 처리
      return prev.map(m => {
        if (m.id === message.id) {
          // 업데이트된 메시지에 sender 정보가 없는 경우 현재 방의 참가자 정보에서 찾아서 보강
          let enrichedMessage = message;
          if (!message.sender && currentRoom) {
            const senderParticipant = currentRoom.participants.find(
              p => p.user_id === message.sender_id || p.user?.id === message.sender_id
            );
            if (senderParticipant?.user) {
              enrichedMessage = {
                ...message,
                sender: {
                  id: senderParticipant.user.id,
                  username: senderParticipant.user.username,
                  avatar_url: senderParticipant.user.avatar_url
                }
              };
            }
          }
          return enrichedMessage;
        }
        return m;
      });
    });
  }, [currentRoom, user]);

  const handleMessageDelete = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // ✅ 재연결 시 메시지 동기화 함수 (경쟁 조건 방지)
  const syncMessages = useCallback(async (roomId: string) => {
    // 현재 방이 아니거나 메시지가 없으면 동기화 불필요
    if (!currentRoom || currentRoom.id !== roomId || messages.length === 0) {
      return;
    }

    // ✅ 경쟁 조건 방지: 이미 동기화 중이면 스킵
    if (syncLockRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ Sync already in progress, skipping');
      }
      return;
    }

    // 락 설정 및 버전 증가
    syncLockRef.current = true;
    const currentVersion = ++syncVersionRef.current;

    try {
      // 마지막 메시지의 타임스탬프를 기준으로 이후 메시지만 가져오기
      const lastMessage = messages[messages.length - 1];
      const since = lastMessage.created_at;

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Syncing messages since: ${since} (version: ${currentVersion})`);
      }

      const response = await fetch(
        `/api/chat/messages?room_id=${roomId}&since=${encodeURIComponent(since)}&limit=50`
      );

      // ✅ 경쟁 조건 방지: 내 요청이 최신인 경우만 결과 적용
      if (currentVersion !== syncVersionRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⏭️ Stale sync response ignored (version: ${currentVersion}, current: ${syncVersionRef.current})`);
        }
        return;
      }

      if (response.ok) {
        const { messages: newMessages } = await response.json();

        if (newMessages.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Synced ${newMessages.length} missed messages`);
          }

          // 중복 제거 및 병합
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNewMessages = newMessages.filter((m: ChatMessage) => !existingIds.has(m.id));
            return [...prev, ...uniqueNewMessages];
          });

          // 채팅방 리스트의 마지막 메시지도 업데이트
          const latestMessage = newMessages[newMessages.length - 1];
          setRooms(prev => {
            const updatedRooms = prev.map(room => {
              if (room.id === roomId) {
                return { ...room, last_message: latestMessage };
              }
              return room;
            });
            return sortRoomsByLastMessage(updatedRooms);
          });
        }
      }
    } catch (error) {
      console.error('Failed to sync messages:', error);
    } finally {
      // ✅ 락 해제 (항상 실행)
      syncLockRef.current = false;
    }
  }, [currentRoom, messages]);

  // 실시간 채팅 훅 사용
  const {
    isConnected,
    connectionState,
    error: realtimeError,
    reconnect
  } = useRealtimeChat({
    roomId: currentRoom?.id || null,
    onNewMessage: handleNewRealtimeMessage,
    onMessageUpdate: handleMessageUpdate,
    onMessageDelete: handleMessageDelete,
    onSyncNeeded: syncMessages // ✅ 재연결 시 동기화 콜백 연결
  });

  // 타이핑 인디케이터
  const {
    typingUsers,
    updateTyping,
    startTyping,
    stopTyping
  } = useTypingIndicator({
    roomId: currentRoom?.id || null
  });

  // ✅ Broadcast 채널 재사용 헬퍼 함수 (중복 구독 방지)
  // 채널 이름: global-rooms:user:${userId} (use-global-chat-rooms-subscription.ts와 일치)
  const getOrCreateBroadcastChannel = useCallback((userId: string): RealtimeChannel => {
    const channelName = `global-rooms:user:${userId}`;

    if (!broadcastChannelCacheRef.current.has(channelName)) {
      const channel = supabase.channel(channelName);
      broadcastChannelCacheRef.current.set(channelName, channel);

      if (process.env.NODE_ENV === 'development') {
        console.log(`📡 Created broadcast channel: ${channelName}`);
      }
    }

    return broadcastChannelCacheRef.current.get(channelName)!;
  }, []);


  // ✅ Broadcast 채널 정리 함수
  const cleanupBroadcastChannels = useCallback(() => {
    broadcastChannelCacheRef.current.forEach((channel, channelName) => {
      try {
        supabase.removeChannel(channel);
        if (process.env.NODE_ENV === 'development') {
          console.log(`🧹 Removed broadcast channel: ${channelName}`);
        }
      } catch (error) {
        console.warn(`Failed to remove channel ${channelName}:`, error);
      }
    });
    broadcastChannelCacheRef.current.clear();
  }, []);

  // 채팅방 목록 로드 (정렬된 채팅방 배열을 반환)
  const loadRooms = useCallback(async (): Promise<ChatRoomWithParticipants[]> => {
    if (!user) return [];

    try {
      setLoading(true);
      const response = await fetch("/api/chat/rooms");
      if (response.ok) {
        const data = await response.json();
        // 최근 메시지 순으로 정렬
        const sortedRooms = sortRoomsByLastMessage(data.rooms || []);
        setRooms(sortedRooms);
        return sortedRooms;
      }
      return [];
    } catch {
      // 채팅방 로드 실패
      toast.error("채팅방을 불러오는데 실패했습니다");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ✅ Optimistic Update로 화면 깜빡임 없이 채팅방 리스트 업데이트
  // + Nav 알림 카운트 업데이트 트리거 (use-notifications.ts의 실시간 구독 제거로 인해 여기서 처리)
  const handleRoomsUpdate = useCallback((update?: any) => {
    if (!update) {
      // payload가 없으면 전체 새로고침 (room_joined, room_left)
      loadRooms();
      return;
    }

    if (update.type === 'new_message' && update.room_id && update.last_message) {
      // ✅ Optimistic Update: 화면 깜빡임 없이 마지막 메시지만 업데이트
      setRooms(prev => {
        const updatedRooms = prev.map(room =>
          room.id === update.room_id
            ? { ...room, last_message: update.last_message as any }
            : room
        );
        return sortRoomsByLastMessage(updatedRooms);
      });

      // ✅ Nav 알림 카운트 업데이트 트리거 (300ms 후 서버 조회)
      // use-notifications.ts의 실시간 구독을 제거했으므로 여기서 카운트 갱신을 트리거
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.unreadCount() });

      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 [handleRoomsUpdate] Triggered unread count refresh for room: ${update.room_id}`);
      }
    } else {
      // 다른 타입은 전체 새로고침
      loadRooms();
    }
  }, [loadRooms, queryClient]);

  // ✅ 전역 채팅방 실시간 구독 (새 메시지 시 리스트 자동 업데이트)
  useGlobalChatRoomsSubscription({
    onRoomsChanged: handleRoomsUpdate // Optimistic Update 사용
  });

  // 메시지 로드
  const loadMessages = useCallback(
    async (roomId: string) => {
      if (!user || !roomId) return;

      try {
        setMessagesLoading(true);

        const response = await fetch(
          `/api/chat/messages?room_id=${roomId}&page=1&limit=50`
        );

        if (response.ok) {
          const data = await response.json();
          // 메시지 로드 완료
          setMessages(data.messages || []);
        }
      } catch {
        // 메시지 로드 실패
        toast.error("메시지를 불러오는데 실패했습니다");
      } finally {
        setMessagesLoading(false);
      }
    },
    [user]
  );

  // 채팅방 선택
  const selectRoom = useCallback(
    async (room: ChatRoomWithParticipants) => {
      // 채팅방 선택
      setCurrentRoom(room);
      await loadMessages(room.id);
    },
    [loadMessages]
  );

  // 채팅방 선택 해제 (메인 페이지로 돌아가기)
  const clearCurrentRoom = useCallback(() => {
    setCurrentRoom(null);
    setMessages([]);
  }, []);

  // 메시지 전송 (Optimistic Update + 실시간 백업)
  // skipOptimistic: handleFileSelect에서 이미 optimistic 메시지를 생성한 경우 중복 방지
  const sendMessage = useCallback(
    async (content: string, roomId: string, file?: File, skipOptimistic: boolean = false) => {
      if (!user || (!content.trim() && !file)) return;

      let optimisticMessage: any = null;

      // ✅ Optimistic update 생성 (skipOptimistic이 false일 때만)
      if (!skipOptimistic) {
        // React 19 + Context7 Pattern: 고유한 임시 ID 생성 (중복 방지)
        optimisticMessage = {
          id: `temp-${Date.now()}-${Math.random()}-${performance.now()}`,
          room_id: roomId,
          sender_id: user.id,
          content: content.trim(),
          message_type: getMessageType(file),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sender: {
            id: user.id,
            username: user.username || "Unknown",
            avatar_url: user.avatar_url || null,
          },
          file_url: file ? URL.createObjectURL(file) : null,
          file_name: file?.name || null,
          file_size: file?.size || null,
          reply_to_id: null,
          reply_to: null,
          reads: [],
          read_by: [user.id],
        };

        // 즉시 UI 업데이트 (optimistic)
        setMessages((prev) => [...prev, optimisticMessage]);
        setRooms((prev) => {
          const updatedRooms = prev.map((room) =>
            room.id === roomId
              ? { ...room, last_message: optimisticMessage }
              : room
          );
          return sortRoomsByLastMessage(updatedRooms);
        });
      }

      try {
        let response: Response;

        if (file) {
          // 파일이 있는 경우 FormData 사용
          const formData = new FormData();
          formData.append('room_id', roomId);
          formData.append('content', content.trim());
          formData.append('message_type', getMessageType(file));
          formData.append('file', file);

          response = await fetch("/api/chat/messages", {
            method: "POST",
            body: formData,
          });
        } else {
          // 파일이 없는 경우 기존 JSON 사용
          response = await fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room_id: roomId,
              content: content.trim(),
              message_type: "text",
            }),
          });
        }

        if (response.ok) {
          const { message } = await response.json();

          // 서버에서 받은 실제 메시지로 교체
          const serverMessage = {
            ...message,
            created_at: message.created_at || new Date().toISOString(),
          };

          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Message sent successfully: ${serverMessage.id}`);
          }

          // ✅ Broadcast로 실시간 전송 (클라이언트에서 전송)
          try {
            // 1. 채팅방 내 메시지 broadcast
            const channel = supabase.channel(`room:${roomId}:messages`);
            await channel.send({
              type: 'broadcast',
              event: 'new_message',
              payload: serverMessage
            });
            if (process.env.NODE_ENV === 'development') {
              console.log(`📡 Broadcast 전송 성공 (채팅방 내): ${serverMessage.id}`);
            }

            // 2. 채팅방 리스트 업데이트를 위한 global broadcast
            // 현재 방의 참여자 찾기
            const targetRoom = rooms.find(r => r.id === roomId);
            if (targetRoom?.participants) {
              // 자신을 제외한 모든 참여자에게 전송
              const broadcastPromises = targetRoom.participants
                .filter(p => p.user_id !== user.id)
                .map(async (participant) => {
                  try {
                    // ✅ 1. Global Rooms 채널로 broadcast (채팅 리스트 업데이트용)
                    const globalChannel = getOrCreateBroadcastChannel(participant.user_id);
                    await globalChannel.send({
                      type: 'broadcast',
                      event: 'new_message',
                      payload: {
                        room_id: roomId,
                        sender_id: user.id,
                        sender_username: user.username || 'Unknown',
                        content: serverMessage.content || '',
                        message_type: serverMessage.message_type || 'text'
                      }
                    });

                    // ✅ notifications 채널 broadcast 제거
                    // global-rooms 채널의 new_message 이벤트를 use-notifications.ts에서도 구독하도록 통합
                    // 중복 카운트 증가 문제 해결
                  } catch (error) {
                    console.warn(`Failed to send broadcast to user ${participant.user_id}:`, error);
                  }
                });

              await Promise.all(broadcastPromises);

              if (process.env.NODE_ENV === 'development') {
                console.log(`📡 All broadcasts 전송 완료 (${targetRoom.participants.length - 1}명, global-rooms + notifications)`);
              }
            }
          } catch (broadcastError) {
            console.warn('Broadcast 전송 실패 (메시지는 저장됨):', broadcastError);
          }

          // ✅ Optimistic 메시지를 실제 메시지로 교체 (skipOptimistic이 false일 때만)
          if (!skipOptimistic && optimisticMessage) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === optimisticMessage.id ? serverMessage : msg
              )
            );

            setRooms((prev) => {
              const updatedRooms = prev.map((room) =>
                room.id === roomId
                  ? { ...room, last_message: serverMessage }
                  : room
              );
              return sortRoomsByLastMessage(updatedRooms);
            });
          }

          return serverMessage;
        } else {
          // 서버 요청 실패시 optimistic 메시지 제거 (optimistic 메시지가 있을 때만)
          if (!skipOptimistic && optimisticMessage) {
            setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
          }
          toast.error("메시지 전송에 실패했습니다");
        }
      } catch (error) {
        // 네트워크 오류시 optimistic 메시지 제거 (optimistic 메시지가 있을 때만)
        if (!skipOptimistic && optimisticMessage) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
        }
        toast.error("메시지 전송에 실패했습니다");
      }
    },
    [user, rooms, getOrCreateBroadcastChannel]
  );

  // 초기 로드
  useEffect(() => {
    if (user) {
      loadRooms();
    }
  }, [user, loadRooms]);

  // ✅ Cleanup: 컴포넌트 언마운트 시 broadcast 채널 정리
  useEffect(() => {
    return () => {
      cleanupBroadcastChannels();
    };
  }, [cleanupBroadcastChannels]);

  // ✅ Admin Client DELETE 이벤트 수신 (커스텀 이벤트 - Hard Delete)
  useEffect(() => {
    const handleCustomDelete = (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId: string }>;
      const { messageId } = customEvent.detail;

      if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ Custom message delete event received:', messageId);
      }

      // handleMessageDelete를 통해 처리
      handleMessageDelete(messageId);
    };

    window.addEventListener('chat-message-deleted', handleCustomDelete);

    return () => {
      window.removeEventListener('chat-message-deleted', handleCustomDelete);
    };
  }, [handleMessageDelete]);

  // ✅ Soft Delete 커스텀 이벤트 수신 (일반 Client UPDATE - Realtime 이벤트가 RLS 필터링으로 도달하지 않음)
  useEffect(() => {
    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<ChatMessage>;
      const updatedMessage = customEvent.detail;

      if (process.env.NODE_ENV === 'development') {
        console.log('📨 Custom message update event received:', updatedMessage.id);
      }

      // handleMessageUpdate를 통해 처리 (Soft Delete 필터링 포함)
      handleMessageUpdate(updatedMessage);
    };

    window.addEventListener('chat-message-updated', handleCustomUpdate);

    return () => {
      window.removeEventListener('chat-message-updated', handleCustomUpdate);
    };
  }, [handleMessageUpdate]);

  // ✅ Optimistic upload: 업로드 중인 임시 메시지 추가
  const addUploadingMessage = useCallback((tempMessage: ChatMessage) => {
    setMessages(prev => [...prev, tempMessage]);
  }, []);

  // ✅ Optimistic upload: 임시 메시지 업데이트 (에러 상태 등)
  const updateUploadingMessage = useCallback((tempId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === tempId ? { ...msg, ...updates } : msg
    ));
  }, []);

  // ✅ Optimistic upload: 임시 메시지 제거
  const removeUploadingMessage = useCallback((tempId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== tempId));
  }, []);

  return {
    rooms,
    currentRoom,
    messages,
    loading,
    messagesLoading,
    selectRoom,
    clearCurrentRoom,
    sendMessage,
    loadRooms,
    loadMessages,
    // 실시간 상태 추가
    isRealtimeConnected: isConnected,
    realtimeConnectionState: connectionState,
    realtimeError,
    reconnectRealtime: reconnect,
    // 타이핑 기능 추가
    typingUsers,
    updateTyping,
    startTyping,
    stopTyping,
    // ✅ Optimistic upload 함수들
    addUploadingMessage,
    updateUploadingMessage,
    removeUploadingMessage,
    // ✅ 직접 메시지 추가 (이미지 업로드 등에서 사용)
    addMessage: handleNewRealtimeMessage
  };
}









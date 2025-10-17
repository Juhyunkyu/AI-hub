"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { ChatMessage, ChatRoomWithParticipants } from "@/types/chat";
import { toast } from "sonner";
import { useRealtimeChat, useTypingIndicator } from "./use-realtime-chat";

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
// 다중 파일 업로드 시 file_name으로 정확히 매칭
const findTempMessage = (messages: ChatMessage[], targetMessage: ChatMessage) => {
  return messages.findIndex(m =>
    m.id.startsWith('temp-') &&
    m.content === targetMessage.content &&
    m.sender_id === targetMessage.sender_id &&
    m.file_name === targetMessage.file_name &&  // ✅ 파일 이름 매칭 추가
    Math.abs(new Date(m.created_at).getTime() - new Date(targetMessage.created_at).getTime()) < 10000
  );
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
  const [rooms, setRooms] = useState<ChatRoomWithParticipants[]>([]);
  const [currentRoom, setCurrentRoom] =
    useState<ChatRoomWithParticipants | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // React 19 + Context7 Pattern: 중복 메시지 처리 방지 (batching 대응)
  const processingMessagesRef = useRef<Set<string>>(new Set());

  // 실시간 메시지 핸들러들 (React 19 최적화)
  const handleNewRealtimeMessage = useCallback((message: ChatMessage) => {
    // Guard: 이미 처리 중인 메시지는 무시 (React batching 중복 방지)
    if (processingMessagesRef.current.has(message.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Duplicate realtime message ignored: ${message.id}`);
      }
      return;
    }

    // 처리 시작 표시
    processingMessagesRef.current.add(message.id);
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

    // 메모리 관리: 1초 후 처리 완료 표시 제거
    setTimeout(() => {
      processingMessagesRef.current.delete(message.id);
    }, 1000);
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

  // ✅ 재연결 시 메시지 동기화 함수
  const syncMessages = useCallback(async (roomId: string) => {
    // 현재 방이 아니거나 메시지가 없으면 동기화 불필요
    if (!currentRoom || currentRoom.id !== roomId || messages.length === 0) {
      return;
    }

    try {
      // 마지막 메시지의 타임스탬프를 기준으로 이후 메시지만 가져오기
      const lastMessage = messages[messages.length - 1];
      const since = lastMessage.created_at;

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Syncing messages since: ${since}`);
      }

      const response = await fetch(
        `/api/chat/messages?room_id=${roomId}&since=${encodeURIComponent(since)}&limit=50`
      );

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
  const sendMessage = useCallback(
    async (content: string, roomId: string, file?: File) => {
      if (!user || (!content.trim() && !file)) return;

      // Optimistic update - 즉시 UI에 메시지 표시
      // React 19 + Context7 Pattern: 고유한 임시 ID 생성 (중복 방지)
      const optimisticMessage = {
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

          // Optimistic 메시지를 실제 메시지로 교체
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

          return serverMessage;
        } else {
          // 서버 요청 실패시 optimistic 메시지 제거
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
          toast.error("메시지 전송에 실패했습니다");
        }
      } catch (error) {
        // 네트워크 오류시 optimistic 메시지 제거
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
        toast.error("메시지 전송에 실패했습니다");
      }
    },
    [user]
  );

  // 초기 로드
  useEffect(() => {
    if (user) {
      loadRooms();
    }
  }, [user, loadRooms]);

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
    stopTyping
  };
}









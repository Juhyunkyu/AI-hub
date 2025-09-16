"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { ChatMessage, ChatRoomWithParticipants } from "@/types/chat";
import { toast } from "sonner";
import { useRealtimeChat, useTypingIndicator } from "./use-realtime-chat";

// 채팅방 정렬 헬퍼 함수
const sortRoomsByLastMessage = (rooms: ChatRoomWithParticipants[]) => {
  return rooms.sort((a, b) => {
    const aTime = a.last_message?.created_at || a.created_at;
    const bTime = b.last_message?.created_at || b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
};

export function useChatHook() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<ChatRoomWithParticipants[]>([]);
  const [currentRoom, setCurrentRoom] =
    useState<ChatRoomWithParticipants | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // 실시간 메시지 핸들러들
  const handleNewRealtimeMessage = useCallback((message: ChatMessage) => {
    console.log(`🔄 Processing realtime message: ${message.id}`, message);

    setMessages(prev => {
      // 임시 메시지 찾기 (optimistic update의 임시 메시지)
      const tempMessageIndex = prev.findIndex(m =>
        m.id.startsWith('temp-') &&
        m.content === message.content &&
        m.sender_id === message.sender_id &&
        Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 10000 // 10초 내
      );

      // 임시 메시지가 있으면 교체, 없으면 추가
      if (tempMessageIndex !== -1) {
        console.log(`🔄 Replacing optimistic message with real message: ${message.id}`);
        const newMessages = [...prev];
        newMessages[tempMessageIndex] = {
          ...message,
          sender: message.sender || prev[tempMessageIndex].sender // sender 정보 보존
        };
        return newMessages;
      }

      // 이미 실제 메시지가 있는지 확인
      const exists = prev.some(m => m.id === message.id);
      if (exists) {
        console.log(`🔄 Message already exists: ${message.id}`);
        return prev;
      }

      // 실시간 메시지에 sender 정보가 없는 경우 현재 방의 참가자 정보에서 찾아서 보강
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
              username: senderParticipant.user.username || "Unknown",
              avatar_url: senderParticipant.user.avatar_url
            }
          };
        }
      }

      console.log(`✅ Adding new realtime message: ${message.id}`);
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
  }, [currentRoom]);

  const handleMessageUpdate = useCallback((message: ChatMessage) => {
    setMessages(prev =>
      prev.map(m => {
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
      })
    );
  }, [currentRoom]);

  const handleMessageDelete = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

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
    onMessageDelete: handleMessageDelete
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

  // 채팅방 목록 로드
  const loadRooms = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch("/api/chat/rooms");
      if (response.ok) {
        const data = await response.json();
        // 최근 메시지 순으로 정렬
        const sortedRooms = sortRoomsByLastMessage(data.rooms || []);
        setRooms(sortedRooms);
      }
    } catch {
      // 채팅방 로드 실패
      toast.error("채팅방을 불러오는데 실패했습니다");
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
        setMessages([]); // 먼저 초기화

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
      setMessages([]); // 먼저 초기화
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
    async (content: string, roomId: string) => {
      if (!user || !content.trim()) return;

      // Optimistic update - 즉시 UI에 메시지 표시
      const optimisticMessage = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        room_id: roomId,
        sender_id: user.id,
        content: content.trim(),
        message_type: "text" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username || "Unknown",
          avatar_url: user.avatar_url || null,
        },
        file_url: null,
        file_name: null,
        file_size: null,
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
        const response = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            content: content.trim(),
            message_type: "text",
          }),
        });

        if (response.ok) {
          const { message } = await response.json();

          // 서버에서 받은 실제 메시지로 교체
          const serverMessage = {
            ...message,
            created_at: message.created_at || new Date().toISOString(),
          };

          console.log(`✅ Message sent successfully: ${serverMessage.id}`, serverMessage);

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
          console.error("❌ Failed to send message - removing optimistic message");
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
          toast.error("메시지 전송에 실패했습니다");
        }
      } catch (error) {
        // 네트워크 오류시 optimistic 메시지 제거
        console.error("❌ Network error sending message:", error);
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








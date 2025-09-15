"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { ChatMessage, ChatRoomWithParticipants } from "@/types/chat";
import { toast } from "sonner";
import { useRealtimeChat } from "./use-realtime-chat";

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
    // 중복 방지: 이미 있는 메시지인지 확인
    setMessages(prev => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;

      // 새 메시지를 리스트 끝에 추가 (시간순 정렬)
      return [...prev, message];
    });

    // 채팅방 리스트의 최근 메시지도 업데이트
    setRooms(prev => {
      const updatedRooms = prev.map(room =>
        room.id === message.room_id
          ? { ...room, last_message: message }
          : room
      );
      return sortRoomsByLastMessage(updatedRooms);
    });
  }, []);

  const handleMessageUpdate = useCallback((message: ChatMessage) => {
    setMessages(prev =>
      prev.map(m => m.id === message.id ? message : m)
    );
  }, []);

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

  // 메시지 전송 (실시간으로 자동 업데이트되므로 수동 업데이트 제거)
  const sendMessage = useCallback(
    async (content: string, roomId: string) => {
      if (!user || !content.trim()) return;

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

          // created_at이 없다면 현재 시간으로 설정
          const messageWithTime = {
            ...message,
            created_at: message.created_at || new Date().toISOString(),
          };

          // 실시간 구독이 활성화되어 있으면 자동으로 메시지가 추가됨
          // 실시간이 연결되지 않은 경우에만 수동 추가
          if (!isConnected) {
            setMessages((prev) => [...prev, messageWithTime]);
            setRooms((prev) => {
              const updatedRooms = prev.map((room) =>
                room.id === roomId
                  ? { ...room, last_message: messageWithTime }
                  : room
              );
              return sortRoomsByLastMessage(updatedRooms);
            });
          }

          return messageWithTime;
        }
      } catch {
        // 메시지 전송 실패
        toast.error("메시지 전송에 실패했습니다");
      }
    },
    [user, isConnected]
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
  };
}






"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { ChatMessage, ChatRoomWithParticipants } from "@/types/chat";
import { toast } from "sonner";

export function useChatHook() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<ChatRoomWithParticipants[]>([]);
  const [currentRoom, setCurrentRoom] =
    useState<ChatRoomWithParticipants | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // 채팅방 목록 로드
  const loadRooms = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch("/api/chat/rooms");
      if (response.ok) {
        const data = await response.json();
        // 최근 메시지 순으로 정렬
        const sortedRooms = (data.rooms || []).sort(
          (a: ChatRoomWithParticipants, b: ChatRoomWithParticipants) => {
            const aTime = a.last_message?.created_at || a.created_at;
            const bTime = b.last_message?.created_at || b.created_at;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          }
        );
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

  // 메시지 전송
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

          // 현재 채팅방의 메시지 목록에 추가
          setMessages((prev) => [...prev, messageWithTime]);

          // 채팅방 리스트의 최근 메시지 업데이트 및 재정렬
          setRooms((prev) => {
            const updatedRooms = prev.map((room) =>
              room.id === roomId
                ? { ...room, last_message: messageWithTime }
                : room
            );

            // 최근 메시지 순으로 재정렬
            return updatedRooms.sort((a, b) => {
              const aTime = a.last_message?.created_at || a.created_at;
              const bTime = b.last_message?.created_at || b.created_at;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
          });

          return messageWithTime;
        }
      } catch {
        // 메시지 전송 실패
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
    selectRoom,
    sendMessage,
    loadRooms,
  };
}


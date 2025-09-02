"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { ChatMessage, ChatRoomWithParticipants } from "@/types/chat";
import { toast } from "sonner";

export function useChat() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<ChatRoomWithParticipants[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoomWithParticipants | null>(null);
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
        const sortedRooms = (data.rooms || []).sort((a: ChatRoomWithParticipants, b: ChatRoomWithParticipants) => {
          const aTime = a.last_message?.created_at || a.created_at;
          const bTime = b.last_message?.created_at || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        setRooms(sortedRooms);
      }
    } catch {
      toast.error("채팅방을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 메시지 로드
  const loadMessages = useCallback(async (roomId: string) => {
    if (!user || !roomId) return;

    try {
      const response = await fetch(`/api/chat/messages?room_id=${roomId}&page=1&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch {
      toast.error("메시지를 불러오는데 실패했습니다");
    }
  }, [user]);

  // 채팅방 선택
  const selectRoom = useCallback(async (room: ChatRoomWithParticipants) => {
    setCurrentRoom(room);
    setMessages([]);
    await loadMessages(room.id);
  }, [loadMessages]);

  // 메시지 전송
  const sendMessage = useCallback(async (content: string, roomId: string) => {
    if (!user || !content.trim()) return;

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          content: content.trim(),
          message_type: "text"
        }),
      });

      if (response.ok) {
        const { message } = await response.json();
        
        const messageWithTime = {
          ...message,
          created_at: message.created_at || new Date().toISOString()
        };
        
        setMessages(prev => [...prev, messageWithTime]);
        
        setRooms(prev => {
          const updatedRooms = prev.map(room => 
            room.id === roomId 
              ? { ...room, last_message: messageWithTime }
              : room
          );
          
          return updatedRooms.sort((a, b) => {
            const aTime = a.last_message?.created_at || a.created_at;
            const bTime = b.last_message?.created_at || b.created_at;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
        });
        
        return messageWithTime;
      }
    } catch {
      toast.error("메시지 전송에 실패했습니다");
    }
  }, [user]);

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
    loadRooms
  };
}
"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@/hooks/use-chat-new";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MoreHorizontal } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { formatMessageTime, formatLastMessageTime } from "@/lib/date-utils";
import { ChatRoomAvatar } from "./chat-room-avatar";
import { ChatRoomParticipantsModal } from "./chat-room-participants-modal";
import { getChatRoomDisplayName } from "@/lib/chat-utils";

interface ChatLayoutProps {
  initialRoomId?: string;
}

export function ChatLayout({ initialRoomId }: ChatLayoutProps) {
  const { user } = useAuthStore();
  const { rooms, currentRoom, messages, loading, selectRoom, sendMessage } = useChat();
  const [newMessage, setNewMessage] = useState("");
  const [showRoomList, setShowRoomList] = useState(true);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 메시지가 변경될 때마다 스크롤을 맨 아래로
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 초기 방 선택
  useEffect(() => {
    if (initialRoomId && rooms.length > 0) {
      const targetRoom = rooms.find(room => room.id === initialRoomId);
      if (targetRoom) {
        selectRoom(targetRoom);
        setShowRoomList(false);
      }
    }
  }, [initialRoomId, rooms, selectRoom]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !newMessage.trim()) return;
    
    await sendMessage(newMessage, currentRoom.id);
    setNewMessage("");
    
    // Textarea 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Textarea 자동 높이 조절
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // 높이 자동 조절
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleRoomSelect = (room: any) => {
    selectRoom(room);
    setShowRoomList(false);
  };

  const handleBackToRooms = () => {
    setShowRoomList(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">로딩 중...</div>;
  }

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      {/* 채팅방 리스트 */}
      <div className={`w-full md:w-80 border-r bg-background ${showRoomList ? 'block' : 'hidden md:block'}`}>
        <div className="p-4 border-b">
          <h2 className="font-semibold">채팅방</h2>
        </div>
        <div className="overflow-y-auto h-full">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="relative p-4 border-b hover:bg-muted cursor-pointer group"
            >
              <div className="flex items-center space-x-3" onClick={() => handleRoomSelect(room)}>
                <ChatRoomAvatar 
                  participants={room.participants} 
                  type={room.type}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">
                      {getChatRoomDisplayName(room, user?.id)}
                    </p>
                    {/* 모든 채팅방에서 점 3개 메뉴 표시 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowParticipantsModal(true);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  {room.last_message && (
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-muted-foreground truncate flex-1 mr-2">
                        {room.last_message.content}
                      </p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatLastMessageTime(room.last_message.created_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className={`flex-1 flex flex-col ${showRoomList ? 'hidden md:flex' : 'flex'}`}>
        {currentRoom ? (
          <>
            {/* 채팅방 헤더 */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToRooms}
                  className="md:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <ChatRoomAvatar 
                  participants={currentRoom.participants} 
                  type={currentRoom.type}
                  size="sm"
                />
                <div>
                  <h3 className="font-semibold">
                    {getChatRoomDisplayName(currentRoom, user?.id)}
                  </h3>
                  {(currentRoom.participants?.length || 0) > 2 && (
                    <p className="text-xs text-muted-foreground">
                      {currentRoom.participants?.length}명
                    </p>
                  )}
                </div>
              </div>
              
              {/* 헤더 메뉴 - 모든 채팅방에서 표시 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowParticipantsModal(true)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.sender_id === user?.id;
                const senderName = message.sender?.username || "알 수 없는 사용자";
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? "" : ""}`}>
                      {/* 상대방 메시지에만 이름 표시 */}
                      {!isOwnMessage && (
                        <p className="text-xs text-muted-foreground mb-1 px-1">
                          {senderName}
                        </p>
                      )}
                      <div
                        className={`px-3 py-2 rounded-lg ${
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* 스크롤 앵커 */}
              <div ref={messagesEndRef} />
            </div>

            {/* 메시지 입력 */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                    // Shift + Enter는 기본 동작(줄바꿈)을 허용
                  }}
                  placeholder="메시지를 입력하세요... (Shift+Enter: 줄바꿈, Enter: 전송)"
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none overflow-y-auto"
                  rows={1}
                />
                <Button type="submit" size="sm" className="mb-1">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            채팅방을 선택해주세요
          </div>
        )}
      </div>
      
      {/* 참여자 모달 */}
      <ChatRoomParticipantsModal
        open={showParticipantsModal}
        onOpenChange={setShowParticipantsModal}
        room={currentRoom}
      />
    </div>
  );
}

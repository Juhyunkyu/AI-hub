"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "next/navigation";
import { useChatHook } from "@/hooks/use-chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Send, MoreHorizontal, Edit } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { formatMessageTime, formatLastMessageTime } from "@/lib/date-utils";
import { ChatRoomAvatar } from "./chat-room-avatar";
import { ChatRoomParticipantsModal } from "./chat-room-participants-modal";
import { getChatRoomDisplayName } from "@/lib/chat-utils";

interface ChatLayoutProps {
  initialRoomId?: string;
}

export interface ChatLayoutRef {
  goToMainPage: () => void;
}

export const ChatLayout = forwardRef<ChatLayoutRef, ChatLayoutProps>(({ initialRoomId }, ref) => {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const {
    rooms,
    currentRoom,
    messages,
    loading,
    messagesLoading,
    loadRooms,
    selectRoom,
    clearCurrentRoom,
    sendMessage
  } = useChatHook();

  // 통합된 UI 상태 관리
  const [uiState, setUIState] = useState({
    newMessage: "",
    showRoomList: true,
    showParticipantsModal: false,
    isEditMode: false,
    selectedRooms: new Set<string>(),
    currentModalRoom: null as any
  });

  // UI 상태 업데이트 헬퍼 함수
  const updateUIState = useCallback((updates: Partial<typeof uiState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 반응형 화면 크기 감지 훅
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  // 메시지 스크롤 최적화 - requestAnimationFrame으로 성능 향상
  const scrollToBottom = useCallback((behavior: "smooth" | "instant" = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  // 외부에서 호출할 수 있는 함수 노출
  const goToMainPage = useCallback(() => {
    clearCurrentRoom();
    // 모바일에서만 리스트 표시 (데스크탑에서는 이미 표시됨)
    if (isMobile) {
      updateUIState({ showRoomList: true });
    }
  }, [clearCurrentRoom, updateUIState, isMobile]);

  useImperativeHandle(ref, () => ({
    goToMainPage
  }), [goToMainPage]);

  useEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      scrollToBottom("instant");
    }
  }, [messages, messagesLoading]);

  // 반응형 화면 크기 변경 감지 최적화
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      updateUIState({
        showRoomList: mobile ? !currentRoom : true
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentRoom, updateUIState]);

  // URL 변경 감지 (NAV에서 채팅 아이콘 클릭 시 메인으로 돌아가기)
  useEffect(() => {
    const resetParam = searchParams?.get('reset');

    // reset=1 파라미터가 있고, 현재 채팅방이 있으면 메인으로 돌아가기
    if (resetParam === '1' && currentRoom) {
      clearCurrentRoom();

      // 모바일에서만 리스트 표시 (데스크탑에서는 이미 표시됨)
      if (isMobile) {
        updateUIState({ showRoomList: true });
      }

      // URL에서 reset 파라미터 제거 (뒤로가기 기록에 남지 않도록)
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, currentRoom, clearCurrentRoom]);

  // 초기 방 선택
  useEffect(() => {
    if (initialRoomId && rooms.length > 0) {
      const targetRoom = rooms.find(room => room.id === initialRoomId);
      if (targetRoom) {
        selectRoom(targetRoom);
        // 데스크탑에서는 리스트를 절대 숨기지 않음
      }
    }
  }, [initialRoomId, rooms, selectRoom]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !uiState.newMessage.trim()) return;

    await sendMessage(uiState.newMessage, currentRoom.id);
    updateUIState({ newMessage: "" });
    setTimeout(() => scrollToBottom("smooth"), 100);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [currentRoom, uiState.newMessage, sendMessage, updateUIState]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateUIState({ newMessage: e.target.value });
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, [updateUIState]);

  const handleRoomSelect = useCallback((room: any) => {
    selectRoom(room);
    // 모바일에서만 리스트 숨김 (데스크탑에서는 항상 표시)
    if (isMobile) {
      updateUIState({ showRoomList: false });
    }
  }, [selectRoom, updateUIState, isMobile]);

  const handleBackToRooms = useCallback(() => {
    if (uiState.isEditMode) {
      updateUIState({
        isEditMode: false,
        selectedRooms: new Set()
      });
    } else {
      // 모바일에서만 리스트 표시, 채팅방 선택 해제
      if (isMobile) {
        updateUIState({ showRoomList: true });
        // currentRoom을 리셋하지 않고 유지 (뒤로가기이므로)
      }
    }
  }, [uiState.isEditMode, updateUIState, isMobile]);

  // 편집 모드 최적화
  const handleEditModeToggle = useCallback(() => {
    updateUIState({
      isEditMode: !uiState.isEditMode,
      selectedRooms: new Set()
    });
  }, [uiState.isEditMode, updateUIState]);

  const handleRoomSelect_Edit = useCallback((roomId: string) => {
    const newSelected = new Set(uiState.selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    updateUIState({ selectedRooms: newSelected });
  }, [uiState.selectedRooms, updateUIState]);


  const openParticipantsModal = useCallback((room: any) => {
    updateUIState({
      currentModalRoom: room,
      showParticipantsModal: true
    });
  }, [updateUIState]);

  // 현재 채팅방 표시명 메모이제이션
  const currentRoomDisplayName = useMemo(() => {
    return currentRoom ? getChatRoomDisplayName(currentRoom, user?.id) : '';
  }, [currentRoom, user?.id]);

  if (loading) {
    return <div className="flex items-center justify-center h-96">로딩 중...</div>;
  }


  return (
    <div className="flex md:h-[600px] md:border md:rounded-lg h-[calc(100vh-80px)] max-h-[600px] overflow-hidden">
      {/* 채팅방 리스트 - 웹에서는 항상 표시, 모바일에서만 토글 */}
      <div
        className={`w-full md:w-80 border-r bg-background relative flex flex-col h-full
          ${uiState.showRoomList ? 'block' : 'hidden'} md:!flex
        `}
      >
        {/* 헤더 */}
        <div className="p-4 border-b flex items-center justify-between bg-background">
          <button
            onClick={goToMainPage}
            className="font-semibold hover:text-primary transition-colors cursor-pointer"
          >
            채팅방
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditModeToggle}
          >
            <Edit className="h-4 w-4" />
            편집
          </Button>
        </div>

        {/* 채팅방 목록 */}
        <div className="overflow-y-auto flex-1">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="relative p-4 border-b hover:bg-muted cursor-pointer group"
            >
              <div className="flex items-center space-x-3">
                {/* 편집 모드 체크박스 */}
                {uiState.isEditMode && (
                  <Checkbox
                    checked={uiState.selectedRooms.has(room.id)}
                    onCheckedChange={() => handleRoomSelect_Edit(room.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                <div
                  className="flex items-center space-x-3 flex-1"
                  onClick={() => !uiState.isEditMode && handleRoomSelect(room)}
                >
                  <ChatRoomAvatar
                    participants={room.participants}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">
                        {getChatRoomDisplayName(room, user?.id)}
                      </p>
                      {!uiState.isEditMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-70 hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openParticipantsModal(room);
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      )}
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
            </div>
          ))}
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className={`flex-1 h-full ${
        uiState.showRoomList ? 'hidden md:flex' : 'flex'
      } flex-col`}>
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
                  size="sm"
                />
                <div>
                  <h3 className="font-semibold">
                    {currentRoomDisplayName}
                  </h3>
                  {(currentRoom.participants?.length || 0) > 2 && (
                    <p className="text-xs text-muted-foreground">
                      {currentRoom.participants?.length}명
                    </p>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateUIState({ showParticipantsModal: true })}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">메시지를 불러오는 중...</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isOwnMessage={message.sender_id === user?.id}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 메시지 입력 */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={uiState.newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
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
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <div className="text-2xl">💬</div>
              <div className="text-sm">채팅방을 선택해주세요</div>
            </div>
          </div>
        )}
      </div>

      {/* 참여자 모달 */}
      <ChatRoomParticipantsModal
        open={uiState.showParticipantsModal}
        onOpenChange={(open) => {
          updateUIState({
            showParticipantsModal: open,
            currentModalRoom: open ? uiState.currentModalRoom : null
          });
        }}
        room={uiState.currentModalRoom}
        onRoomLeft={() => {
          loadRooms();
          if (currentRoom && uiState.currentModalRoom && currentRoom.id === uiState.currentModalRoom.id && isMobile) {
            updateUIState({ showRoomList: true });
          }
        }}
      />
    </div>
  );
});

// displayName 설정 (forwardRef 사용 시 권장)
ChatLayout.displayName = 'ChatLayout';

// 메시지 아이템 최적화 컴포넌트 - React.memo로 성능 최적화
const MessageItem = memo(({ message, isOwnMessage }: {
  message: any;
  isOwnMessage: boolean;
}) => {
  // 날짜 포맷팅 메모이제이션
  const formattedTime = useMemo(() => formatMessageTime(message.created_at), [message.created_at]);

  return (
  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} gap-2`}>
    {!isOwnMessage && (
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.sender?.avatar_url || ""} />
        <AvatarFallback>
          {message.sender?.username?.[0]?.toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
    )}

    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
      {!isOwnMessage && (
        <div className="text-xs text-muted-foreground mb-1">
          {message.sender?.username || "알 수 없는 사용자"}
        </div>
      )}

      <div className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`px-3 py-2 rounded-lg max-w-full ${
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}>
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex-shrink-0 pb-1">
          {formattedTime}
        </div>
      </div>
    </div>
  </div>
  );
});


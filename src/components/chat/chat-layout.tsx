"use client";
"use memo";

import { useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";
import { useChatHook } from "@/hooks/use-chat";
import { useNotifications } from "@/hooks/use-notifications";
import { useChatUIState } from "@/hooks/use-chat-ui-state";
import { useChatMessageHandler } from "@/hooks/use-chat-message-handler";
import { useResponsive } from "@/hooks/use-responsive";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MoreHorizontal, Edit, Search, Plus, X, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { formatLastMessageTime } from "@/lib/date-utils";
import { ChatRoomAvatar } from "./chat-room-avatar";
import { ChatRoomParticipantsModal } from "./chat-room-participants-modal";
import { RealtimeStatus } from "./realtime-status";
import { getChatRoomDisplayName } from "@/lib/chat-utils";
import { VirtualizedMessageList } from "./virtualized";
import { deleteChatRooms } from "@/lib/chat-api";
// Dynamic imports for performance optimization (lazy loading)
const UserSearchModal = dynamic(() =>
  import("./modals/user-search-modal").then(mod => ({ default: mod.UserSearchModal })), {
  loading: () => <div className="p-4 text-center">로딩 중...</div>,
  ssr: false
});

const ChatCreateModal = dynamic(() =>
  import("./modals/chat-create-modal").then(mod => ({ default: mod.ChatCreateModal })), {
  loading: () => <div className="p-4 text-center">로딩 중...</div>,
  ssr: false
});

const DeleteRoomsModal = dynamic(() =>
  import("./modals/delete-rooms-modal").then(mod => ({ default: mod.DeleteRoomsModal })), {
  loading: () => <div className="p-4 text-center">로딩 중...</div>,
  ssr: false
});

interface ChatLayoutProps {
  initialRoomId?: string;
}

export interface ChatLayoutRef {
  goToMainPage: () => void;
}

export const ChatLayout = forwardRef<ChatLayoutRef, ChatLayoutProps>(({ initialRoomId }, ref) => {
  const { user } = useAuthStore();
  const {
    rooms,
    currentRoom,
    messages,
    loading,
    messagesLoading,
    loadRooms,
    selectRoom,
    clearCurrentRoom,
    sendMessage,
    isRealtimeConnected,
    realtimeConnectionState,
    realtimeError,
    reconnectRealtime,
    typingUsers,
    updateTyping,
    stopTyping
  } = useChatHook();

  // 알림 시스템
  const { getUnreadCount, markAsRead } = useNotifications();

  // 반응형 화면 크기 감지
  const { isMobile } = useResponsive();

  // UI 상태 관리
  const {
    uiState,
    updateUIState,
    goToMainPage,
    handleBackToRooms,
    handleEditModeToggle,
    exitEditMode,
    handleRoomSelectEdit,
    handleUserSearch,
    handleChatCreate,
    handleDeleteRooms,
    openParticipantsModal
  } = useChatUIState({ isMobile, currentRoom, clearCurrentRoom });

  // 메시지 핸들링
  const {
    newMessage,
    messagesContainerHeight,
    textareaRef,
    virtualizedListRef,
    messagesContainerRef,
    handleSendMessage,
    handleTextareaChange,
    handleKeyDown,
    stopTyping: stopTypingHandler
  } = useChatMessageHandler({
    currentRoom,
    sendMessage,
    updateTyping,
    stopTyping,
    messages,
    messagesLoading,
    isRealtimeConnected
  });

  // 외부에서 호출할 수 있는 함수 노출
  useImperativeHandle(ref, () => ({
    goToMainPage
  }), [goToMainPage]);


  // 초기 방 선택
  useEffect(() => {
    if (initialRoomId && rooms.length > 0) {
      const targetRoom = rooms.find(room => room.id === initialRoomId);
      if (targetRoom) {
        selectRoom(targetRoom);
        markAsRead(targetRoom.id); // 초기 방 선택 시에도 읽음 처리
        // 데스크탑에서는 리스트를 절대 숨기지 않음
      }
    }
  }, [initialRoomId, rooms, selectRoom, markAsRead]);

  // 현재 방에서 새 메시지를 받으면 자동으로 읽음 처리
  useEffect(() => {
    if (currentRoom && messages.length > 0 && !messagesLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.sender_id !== user?.id) {
        // 다른 사용자의 메시지인 경우 읽음 처리
        markAsRead(currentRoom.id, lastMessage.id);
      }
    }
  }, [currentRoom, messages, messagesLoading, user?.id, markAsRead]);


  const handleRoomSelect = useCallback(async (room: any) => {
    selectRoom(room);

    // 채팅방을 선택하면 읽음 상태로 표시
    await markAsRead(room.id);

    // 모바일에서만 리스트 숨김 (데스크탑에서는 항상 표시)
    if (isMobile) {
      updateUIState({ showRoomList: false });
    }
  }, [selectRoom, updateUIState, isMobile, markAsRead]);


  const handleConfirmDelete = useCallback(async () => {
    if (uiState.selectedRooms.size === 0) return;

    try {
      const roomIds = Array.from(uiState.selectedRooms);
      const result = await deleteChatRooms(roomIds);

      if (result.success) {
        // 성공 시 상태 초기화 및 채팅방 목록 새로고침
        updateUIState({
          isEditMode: false,
          selectedRooms: new Set(),
          showDeleteConfirmModal: false
        });

        // 삭제된 채팅방이 현재 선택된 채팅방이면 선택 해제
        if (currentRoom && uiState.selectedRooms.has(currentRoom.id)) {
          clearCurrentRoom();
          if (isMobile) {
            updateUIState({ showRoomList: true });
          }
        }

        // 채팅방 목록 새로고침
        await loadRooms();

        // 사용자에게 결과 알림 (선택사항)
        console.log(`${result.deletedCount}개 채팅방이 삭제되었습니다.`);
        if (result.error) {
          console.warn(result.error);
        }
      } else {
        // 실패 시 에러 처리
        console.error('채팅방 삭제 실패:', result.error);
        updateUIState({ showDeleteConfirmModal: false });
      }
    } catch (error) {
      console.error('채팅방 삭제 중 오류:', error);
      updateUIState({ showDeleteConfirmModal: false });
    }
  }, [uiState.selectedRooms, currentRoom, updateUIState, clearCurrentRoom, isMobile, loadRooms]);


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
          <div className="flex items-center gap-1">
            {uiState.isEditMode ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={uiState.selectedRooms.size === 0}
                  onClick={handleDeleteRooms}
                >
                  <Trash2 className="h-4 w-4" />
                  삭제 ({uiState.selectedRooms.size})
                </Button>
                <Button variant="ghost" size="sm" onClick={exitEditMode}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUserSearch}
                  title="전체 사용자 검색"
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleChatCreate}
                  title="새 채팅방"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditModeToggle}
                  title="편집"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
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
                    onCheckedChange={() => handleRoomSelectEdit(room.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                <div
                  className="flex items-center space-x-3 flex-1"
                  onClick={() => !uiState.isEditMode && handleRoomSelect(room)}
                >
                  <ChatRoomAvatar
                    participants={room.participants}
                    type={room.type}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {getChatRoomDisplayName(room, user?.id)}
                        </p>
                        {(() => {
                          const unreadCount = getUnreadCount(room.id);
                          return unreadCount > 0 ? (
                            <Badge
                              variant="destructive"
                              className="h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center flex-shrink-0"
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      {!uiState.isEditMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-70 hover:opacity-100 transition-opacity h-6 w-6 p-0 flex-shrink-0"
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
                        <p className="text-sm text-muted-foreground truncate max-w-[120px] md:max-w-[160px] mr-2">
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
                  type={currentRoom.type}
                  size="sm"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {currentRoomDisplayName}
                    </h3>
                    <RealtimeStatus
                      currentRoom={currentRoom}
                      realtimeConnectionState={realtimeConnectionState}
                      realtimeError={realtimeError}
                      reconnectRealtime={reconnectRealtime}
                    />
                  </div>
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
                onClick={() => updateUIState({
                  showParticipantsModal: true,
                  currentModalRoom: currentRoom
                })}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* 메시지 영역 */}
            <div ref={messagesContainerRef} className="flex-1 overflow-hidden">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">메시지를 불러오는 중...</div>
                </div>
              ) : (
                // 가상화 메시지 리스트 (타이핑 인디케이터 포함)
                <VirtualizedMessageList
                  ref={virtualizedListRef}
                  messages={messages}
                  currentUserId={user?.id}
                  containerHeight={messagesContainerHeight}
                  scrollToBottom={!messagesLoading && messages.length > 0}
                  className="h-full"
                  typingUsers={typingUsers}
                  participants={currentRoom?.participants}
                />
              )}
            </div>


            {/* 메시지 입력 */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  onBlur={stopTypingHandler} // 포커스 아웃 시 타이핑 중지
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
          // 나간 채팅방이 현재 선택된 채팅방이면 메인으로 이동
          if (currentRoom && uiState.currentModalRoom && currentRoom.id === uiState.currentModalRoom.id) {
            clearCurrentRoom(); // 현재 채팅방 선택 해제
            if (isMobile) {
              updateUIState({ showRoomList: true });
            }
          }
          // 채팅방 목록 새로고침
          loadRooms();
        }}
      />

      {/* 사용자 검색 모달 */}
      <UserSearchModal
        open={uiState.showUserSearchModal}
        onClose={() => updateUIState({ showUserSearchModal: false })}
        onChatCreated={async (roomId) => {
          console.log("Direct chat room created:", roomId);
          // 먼저 모달 닫기
          updateUIState({ showUserSearchModal: false });

          // 채팅방 목록 새로고침하고 반환된 데이터에서 직접 찾기
          const updatedRooms = await loadRooms();
          const targetRoom = updatedRooms.find(room => room.id === roomId);

          if (targetRoom) {
            selectRoom(targetRoom);
            await markAsRead(roomId);
            if (isMobile) {
              updateUIState({ showRoomList: false });
            }
          } else {
            console.warn(`채팅방 ${roomId}를 찾을 수 없습니다. 생성된 채팅방들:`, updatedRooms.map(r => r.id));
          }
        }}
      />

      {/* 채팅방 생성 모달 */}
      <ChatCreateModal
        open={uiState.showChatCreateModal}
        onClose={() => updateUIState({ showChatCreateModal: false })}
        onChatCreated={() => {
          loadRooms(); // 채팅방 목록 새로고침
        }}
      />

      {/* 채팅방 삭제 확인 모달 */}
      <DeleteRoomsModal
        open={uiState.showDeleteConfirmModal}
        onClose={() => updateUIState({ showDeleteConfirmModal: false })}
        onConfirm={handleConfirmDelete}
        roomCount={uiState.selectedRooms.size}
      />
    </div>
  );
});

// displayName 설정 (forwardRef 사용 시 권장)
ChatLayout.displayName = 'ChatLayout';







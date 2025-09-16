"use client";
"use memo";

import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useChatHook } from "@/hooks/use-chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Send, MoreHorizontal, Edit, Search, Plus, X, Trash2, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { formatMessageTime, formatLastMessageTime } from "@/lib/date-utils";
import { ChatRoomAvatar } from "./chat-room-avatar";
import { ChatRoomParticipantsModal } from "./chat-room-participants-modal";
import { getChatRoomDisplayName } from "@/lib/chat-utils";
import { VirtualizedMessageList, type VirtualizedMessageListRef } from "./virtualized";
import { TypingIndicator } from "./TypingIndicator";
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
    sendMessage,
    isRealtimeConnected,
    realtimeConnectionState,
    realtimeError,
    reconnectRealtime,
    typingUsers,
    updateTyping,
    startTyping,
    stopTyping
  } = useChatHook();

  // 통합된 UI 상태 관리
  const [uiState, setUIState] = useState({
    newMessage: "",
    showRoomList: true,
    showParticipantsModal: false,
    isEditMode: false,
    selectedRooms: new Set<string>(),
    currentModalRoom: null as any,
    showUserSearchModal: false,
    showChatCreateModal: false,
    showDeleteConfirmModal: false
  });

  // 메시지 컨테이너 높이 동적 계산
  const [messagesContainerHeight, setMessagesContainerHeight] = useState(400);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // UI 상태 업데이트 헬퍼 함수
  const updateUIState = useCallback((updates: Partial<typeof uiState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const virtualizedListRef = useRef<VirtualizedMessageListRef>(null);

  // 반응형 화면 크기 감지 훅
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  // 메시지 스크롤 최적화 - 가상화 전용
  const scrollToBottom = useCallback((behavior: "smooth" | "instant" = "smooth") => {
    if (virtualizedListRef.current) {
      virtualizedListRef.current.scrollToBottom(behavior);
    }
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
      // 실시간 메시지인지 확인 (메시지가 추가된 경우)
      const isNewMessage = messages.length > 0;

      // 실시간 연결 상태에서는 부드러운 스크롤, 초기 로드 시에는 즉시 스크롤
      if (isRealtimeConnected && isNewMessage) {
        // 실시간 메시지: 부드러운 스크롤 (사용자가 하단에 있을 때만)
        setTimeout(() => scrollToBottom("smooth"), 100);
      } else {
        // 초기 로드: 즉시 스크롤
        scrollToBottom("instant");
      }
    }
  }, [messages, messagesLoading, isRealtimeConnected, scrollToBottom]);

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

    const messageContent = uiState.newMessage;
    updateUIState({ newMessage: "" });

    // 메시지 전송
    await sendMessage(messageContent, currentRoom.id);

    // 실시간 연결 상태에 관계없이 메시지 전송 후 즉시 스크롤
    setTimeout(() => scrollToBottom("smooth"), 100);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [currentRoom, uiState.newMessage, sendMessage, updateUIState, scrollToBottom]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    updateUIState({ newMessage: value });

    // 텍스트 에리어 높이 자동 조절
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';

    // 타이핑 상태 업데이트
    if (value.trim()) {
      updateTyping(); // 타이핑 시작 + 2초 후 자동 중지
    } else {
      stopTyping(); // 입력이 비어있으면 즉시 중지
    }
  }, [updateUIState, updateTyping, stopTyping]);

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

  // 헤더 버튼 핸들러들
  const handleUserSearch = useCallback(() => {
    updateUIState({ showUserSearchModal: true });
  }, [updateUIState]);

  const handleChatCreate = useCallback(() => {
    updateUIState({ showChatCreateModal: true });
  }, [updateUIState]);

  const handleDeleteRooms = useCallback(() => {
    if (uiState.selectedRooms.size === 0) return;
    updateUIState({ showDeleteConfirmModal: true });
  }, [uiState.selectedRooms.size, updateUIState]);

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

  const exitEditMode = useCallback(() => {
    updateUIState({
      isEditMode: false,
      selectedRooms: new Set()
    });
  }, [updateUIState]);

  // 메시지 컨테이너 높이 동적 업데이트
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const updateContainerHeight = () => {
      if (messagesContainerRef.current) {
        const height = messagesContainerRef.current.offsetHeight;
        if (height > 0) {
          setMessagesContainerHeight(height);
        }
      }
    };

    // 초기 높이 설정
    updateContainerHeight();

    // ResizeObserver로 크기 변경 감지
    const resizeObserver = new ResizeObserver(() => {
      updateContainerHeight();
    });

    resizeObserver.observe(messagesContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [currentRoom, uiState.showRoomList]);

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

  // 실시간 연결 상태 표시 컴포넌트
  const RealtimeStatus = useMemo(() => {
    if (!currentRoom) return null;

    const getStatusColor = () => {
      switch (realtimeConnectionState) {
        case 'connected': return 'text-green-500';
        case 'connecting': return 'text-yellow-500';
        case 'error': return 'text-red-500';
        default: return 'text-gray-400';
      }
    };

    const getStatusIcon = () => {
      switch (realtimeConnectionState) {
        case 'connected': return <Wifi className="h-3 w-3" />;
        case 'connecting': return <div className="h-3 w-3 animate-spin border border-yellow-500 border-t-transparent rounded-full" />;
        case 'error': return <WifiOff className="h-3 w-3" />;
        default: return <WifiOff className="h-3 w-3" />;
      }
    };

    const getStatusText = () => {
      switch (realtimeConnectionState) {
        case 'connected': return '실시간';
        case 'connecting': return '연결 중...';
        case 'error': return '연결 오류';
        default: return '오프라인';
      }
    };

    return (
      <div className={`flex items-center space-x-1 text-xs ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        {realtimeError && (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 text-red-500 hover:text-red-600"
            onClick={reconnectRealtime}
            title={`재연결 시도 (에러: ${realtimeError})`}
          >
            <AlertCircle className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }, [currentRoom, realtimeConnectionState, realtimeError, reconnectRealtime]);

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
                    type={room.type}
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
                    {RealtimeStatus}
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
                // 가상화 메시지 리스트 (항상 사용)
                <VirtualizedMessageList
                  ref={virtualizedListRef}
                  messages={messages}
                  currentUserId={user?.id}
                  containerHeight={messagesContainerHeight}
                  scrollToBottom={!messagesLoading && messages.length > 0}
                  className="h-full"
                />
              )}
            </div>

            {/* 타이핑 인디케이터 */}
            <TypingIndicator
              typingUsers={typingUsers}
              participants={currentRoom?.participants}
            />

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
                  onBlur={stopTyping} // 포커스 아웃 시 타이핑 중지
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
        onChatCreated={(roomId) => {
          console.log("Direct chat room created:", roomId);
          // 채팅방 목록 새로고침 후 생성된 채팅방으로 이동
          loadRooms().then(() => {
            const targetRoom = rooms.find(room => room.id === roomId);
            if (targetRoom) {
              selectRoom(targetRoom);
              if (isMobile) {
                updateUIState({ showRoomList: false });
              }
            }
          });
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






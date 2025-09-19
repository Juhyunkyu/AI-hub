import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface ChatUIState {
  newMessage: string;
  showRoomList: boolean;
  showParticipantsModal: boolean;
  isEditMode: boolean;
  selectedRooms: Set<string>;
  currentModalRoom: any;
  showUserSearchModal: boolean;
  showChatCreateModal: boolean;
  showDeleteConfirmModal: boolean;
}

interface UseChatUIStateProps {
  isMobile: boolean;
  currentRoom: any;
  clearCurrentRoom: () => void;
}

export function useChatUIState({ isMobile, currentRoom, clearCurrentRoom }: UseChatUIStateProps) {
  const searchParams = useSearchParams();

  // 통합된 UI 상태 관리
  const [uiState, setUIState] = useState<ChatUIState>({
    newMessage: "",
    showRoomList: true,
    showParticipantsModal: false,
    isEditMode: false,
    selectedRooms: new Set<string>(),
    currentModalRoom: null,
    showUserSearchModal: false,
    showChatCreateModal: false,
    showDeleteConfirmModal: false
  });

  // UI 상태 업데이트 헬퍼 함수
  const updateUIState = useCallback((updates: Partial<ChatUIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);

  // 메인 페이지로 이동
  const goToMainPage = useCallback(() => {
    clearCurrentRoom();
    // 모바일에서만 리스트 표시 (데스크탑에서는 이미 표시됨)
    if (isMobile) {
      updateUIState({ showRoomList: true });
    }
  }, [clearCurrentRoom, updateUIState, isMobile]);

  // 뒤로가기 핸들러
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

  // 편집 모드 토글
  const handleEditModeToggle = useCallback(() => {
    updateUIState({
      isEditMode: !uiState.isEditMode,
      selectedRooms: new Set()
    });
  }, [uiState.isEditMode, updateUIState]);

  // 편집 모드 종료
  const exitEditMode = useCallback(() => {
    updateUIState({
      isEditMode: false,
      selectedRooms: new Set()
    });
  }, [updateUIState]);

  // 채팅방 선택 (편집 모드)
  const handleRoomSelectEdit = useCallback((roomId: string) => {
    const newSelected = new Set(uiState.selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    updateUIState({ selectedRooms: newSelected });
  }, [uiState.selectedRooms, updateUIState]);

  // 모달 핸들러들
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

  const openParticipantsModal = useCallback((room: any) => {
    updateUIState({
      currentModalRoom: room,
      showParticipantsModal: true
    });
  }, [updateUIState]);


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
  }, [searchParams, currentRoom, clearCurrentRoom, isMobile, updateUIState]);

  // 반응형 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      updateUIState({
        showRoomList: mobile ? !currentRoom : true
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentRoom, updateUIState]);

  return {
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
  };
}
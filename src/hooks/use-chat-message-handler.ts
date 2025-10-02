import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { VirtualizedMessageListRef } from '@/components/chat/virtualized';

interface UseChatMessageHandlerProps {
  currentRoom: any;
  sendMessage: (content: string, roomId: string, file?: File) => Promise<void>;
  updateTyping: () => void;
  stopTyping: () => void;
  messages: any[];
  messagesLoading: boolean;
  isRealtimeConnected: boolean;
  selectedFile?: File | null;
  onFileRemove?: () => void;
}

export function useChatMessageHandler({
  currentRoom,
  sendMessage,
  updateTyping,
  stopTyping,
  messages,
  messagesLoading,
  isRealtimeConnected,
  selectedFile,
  onFileRemove
}: UseChatMessageHandlerProps) {
  const [newMessage, setNewMessage] = useState("");
  const [messagesContainerHeight, setMessagesContainerHeight] = useState(400);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const virtualizedListRef = useRef<VirtualizedMessageListRef>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Context7 Pattern: Debounce typing indicator (500ms delay, trailing edge)
  const debouncedUpdateTyping = useMemo(() =>
    debounce(() => {
      updateTyping();
    }, 500, {
      trailing: true  // Invoke on trailing edge (after typing stops)
    }),
  [updateTyping]);

  // 메시지 스크롤 최적화 - 가상화 전용
  const scrollToBottom = useCallback((behavior: "smooth" | "instant" = "smooth") => {
    if (virtualizedListRef.current) {
      virtualizedListRef.current.scrollToBottom(behavior);
    }
  }, []);

  // 메시지 전송 핸들러
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom) return;

    // 메시지나 파일 중 하나라도 있어야 전송 가능
    const hasMessage = newMessage.trim().length > 0;
    const hasFile = selectedFile !== null;
    if (!hasMessage && !hasFile) return;

    const messageContent = newMessage;
    setNewMessage("");

    // 메시지 전송 (파일 포함)
    await sendMessage(messageContent, currentRoom.id, selectedFile || undefined);

    // 파일 제거
    if (selectedFile && onFileRemove) {
      onFileRemove();
    }

    // 실시간 연결 상태에 관계없이 메시지 전송 후 즉시 스크롤
    setTimeout(() => scrollToBottom("smooth"), 100);

    // React 19 호환성: null 체크 강화
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [currentRoom, newMessage, selectedFile, sendMessage, onFileRemove, scrollToBottom]);

  // 텍스트 입력 핸들러 - React 19 최적화
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // 텍스트 에리어 높이 자동 조절 (null 체크 추가)
    const textarea = e.target;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // 타이핑 상태 업데이트 - Debounced for performance
    if (value.trim()) {
      debouncedUpdateTyping(); // Debounced: only calls after 500ms of no typing
    } else {
      debouncedUpdateTyping.cancel(); // Cancel pending invocation
      stopTyping(); // 입력이 비어있으면 즉시 중지
    }
  }, [debouncedUpdateTyping, stopTyping]);

  // Cleanup: Cancel debounced function on unmount (prevent memory leaks)
  useEffect(() => {
    return () => {
      if (debouncedUpdateTyping) {
        debouncedUpdateTyping.cancel();
      }
    };
  }, [debouncedUpdateTyping]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  }, [handleSendMessage]);

  // 메시지 목록 변경 시 자동 스크롤
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

  // 메시지 컨테이너 높이 동적 업데이트 - React 19 최적화
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const updateContainerHeight = () => {
      const container = messagesContainerRef.current;
      if (container) {
        const height = container.offsetHeight;
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
  }, [currentRoom]);

  return {
    newMessage,
    setNewMessage,
    messagesContainerHeight,
    textareaRef,
    virtualizedListRef,
    messagesContainerRef,
    handleSendMessage,
    handleTextareaChange,
    handleKeyDown,
    scrollToBottom,
    stopTyping
  };
}
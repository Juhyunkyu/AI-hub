import { useState, useCallback, useRef, useEffect } from 'react';
import { VirtualizedMessageListRef } from '@/components/chat/virtualized';

interface UseChatMessageHandlerProps {
  currentRoom: any;
  sendMessage: (content: string, roomId: string) => Promise<void>;
  updateTyping: () => void;
  stopTyping: () => void;
  messages: any[];
  messagesLoading: boolean;
  isRealtimeConnected: boolean;
}

export function useChatMessageHandler({
  currentRoom,
  sendMessage,
  updateTyping,
  stopTyping,
  messages,
  messagesLoading,
  isRealtimeConnected
}: UseChatMessageHandlerProps) {
  const [newMessage, setNewMessage] = useState("");
  const [messagesContainerHeight, setMessagesContainerHeight] = useState(400);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const virtualizedListRef = useRef<VirtualizedMessageListRef>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 메시지 스크롤 최적화 - 가상화 전용
  const scrollToBottom = useCallback((behavior: "smooth" | "instant" = "smooth") => {
    if (virtualizedListRef.current) {
      virtualizedListRef.current.scrollToBottom(behavior);
    }
  }, []);

  // 메시지 전송 핸들러
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !newMessage.trim()) return;

    const messageContent = newMessage;
    setNewMessage("");

    // 메시지 전송
    await sendMessage(messageContent, currentRoom.id);

    // 실시간 연결 상태에 관계없이 메시지 전송 후 즉시 스크롤
    setTimeout(() => scrollToBottom("smooth"), 100);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [currentRoom, newMessage, sendMessage, scrollToBottom]);

  // 텍스트 입력 핸들러
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

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
  }, [updateTyping, stopTyping]);

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
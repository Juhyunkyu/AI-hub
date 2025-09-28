"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/chat";

interface UseNewMessageNotificationProps {
  /** 현재 사용자 ID */
  currentUserId?: string;
  /** 메시지 목록 */
  messages: ChatMessage[];
  /** 사용자가 현재 맨 아래에 있는지 여부 */
  isAtBottom: boolean;
  /** 창이 현재 포커스되어 있는지 여부 */
  isWindowFocused: boolean;
}

interface UseNewMessageNotificationReturn {
  /** 알림 표시 여부 */
  showNotification: boolean;
  /** 새 메시지 개수 */
  newMessageCount: number;
  /** 마지막 메시지 미리보기 */
  lastMessagePreview: string;
  /** 알림 닫기 함수 */
  dismissNotification: () => void;
  /** 새 메시지 알림 표시 함수 */
  showNewMessageNotification: (message: ChatMessage) => void;
}

/**
 * 새 메시지 알림 상태 관리 훅
 *
 * 기능:
 * - 사용자가 스크롤을 올려놓은 상태에서 새 메시지가 도착하면 알림 표시
 * - 창이 숨겨진 상태에서 메시지가 도착하면 알림 표시 (창 복원 시)
 * - 현재 사용자 메시지는 알림 표시하지 않음
 * - 메시지 개수 누적
 * - 마지막 메시지 미리보기 표시
 */
export function useNewMessageNotification({
  currentUserId,
  messages,
  isAtBottom,
  isWindowFocused
}: UseNewMessageNotificationProps): UseNewMessageNotificationReturn {
  const [showNotification, setShowNotification] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [lastMessagePreview, setLastMessagePreview] = useState("");

  // 이전 메시지 개수 추적
  const previousMessageCountRef = useRef(messages.length);
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  // 알림 닫기
  const dismissNotification = useCallback(() => {
    setShowNotification(false);
    setNewMessageCount(0);
    setLastMessagePreview("");
  }, []);

  // 새 메시지 알림 표시
  const showNewMessageNotification = useCallback((message: ChatMessage) => {
    // 현재 사용자의 메시지는 알림 표시하지 않음
    if (message.sender_id === currentUserId) {
      return;
    }

    // 메시지 미리보기 텍스트 생성 (최대 50자)
    const preview = message.content?.length > 50
      ? `${message.content.substring(0, 50)}...`
      : message.content || '새 메시지';

    setLastMessagePreview(preview);
    setNewMessageCount(prev => prev + 1);
    setShowNotification(true);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔔 New message notification: ${message.id}`);
    }
  }, [currentUserId]);

  // 메시지 목록 변경 감지
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousMessageCount = previousMessageCountRef.current;

    // 새 메시지가 추가된 경우
    if (currentMessageCount > previousMessageCount) {
      const newMessages = messages.slice(previousMessageCount);

      for (const newMessage of newMessages) {
        // 이미 처리된 메시지는 건너뛰기
        if (lastProcessedMessageIdRef.current === newMessage.id) {
          continue;
        }

        // 다음 조건에서 알림 표시:
        // 1. 사용자가 맨 아래에 있지 않음 OR
        // 2. 창이 포커스되어 있지 않음
        const shouldShowNotification = !isAtBottom || !isWindowFocused;

        if (shouldShowNotification) {
          showNewMessageNotification(newMessage);
        }

        lastProcessedMessageIdRef.current = newMessage.id;
      }
    }

    previousMessageCountRef.current = currentMessageCount;
  }, [messages, isAtBottom, isWindowFocused, showNewMessageNotification]);

  // 사용자가 맨 아래로 스크롤하면 알림 자동 닫기
  useEffect(() => {
    if (isAtBottom && showNotification) {
      dismissNotification();
    }
  }, [isAtBottom, showNotification, dismissNotification]);

  // 창이 포커스되면 알림 자동 닫기 (지연 후)
  useEffect(() => {
    if (isWindowFocused && showNotification) {
      // 창 포커스 후 1초 뒤에 알림 닫기 (사용자가 확인할 시간 제공)
      const timer = setTimeout(() => {
        dismissNotification();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isWindowFocused, showNotification, dismissNotification]);

  return {
    showNotification,
    newMessageCount,
    lastMessagePreview,
    dismissNotification,
    showNewMessageNotification
  };
}
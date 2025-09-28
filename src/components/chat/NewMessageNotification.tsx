"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, X } from "lucide-react";

interface NewMessageNotificationProps {
  /** 새 메시지 수 */
  newMessageCount: number;
  /** 알림 클릭 시 호출되는 함수 */
  onScrollToBottom: () => void;
  /** 알림 닫기 시 호출되는 함수 */
  onDismiss: () => void;
  /** 알림 표시 여부 */
  show: boolean;
  /** 마지막 메시지 미리보기 */
  lastMessagePreview?: string;
  /** 표시 시간 (ms) - 기본값: 5초 */
  autoHideDelay?: number;
}

/**
 * 카카오톡 스타일의 새 메시지 알림 컴포넌트
 *
 * 기능:
 * - 새 메시지가 도착했을 때 하단에 플로팅 알림 표시
 * - 메시지 개수와 미리보기 텍스트 표시
 * - 클릭 시 채팅방 하단으로 스크롤
 * - 자동 숨김 기능 (5초 후)
 * - 수동 닫기 버튼
 */
export function NewMessageNotification({
  newMessageCount,
  onScrollToBottom,
  onDismiss,
  show,
  lastMessagePreview,
  autoHideDelay = 5000
}: NewMessageNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 자동 숨김 처리
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (show && autoHideDelay > 0) {
      timeoutId = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [show, autoHideDelay]);

  // 표시/숨김 애니메이션 처리
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // 애니메이션을 위한 짧은 지연
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // 애니메이션 완료 후 DOM에서 제거
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const handleDismiss = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      onDismiss();
    }, 200);
  }, [onDismiss]);

  const handleClick = useCallback(() => {
    onScrollToBottom();
    handleDismiss();
  }, [onScrollToBottom, handleDismiss]);

  // 알림이 표시되지 않으면 렌더링하지 않음
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-200 ease-out ${
        isAnimating
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-95'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-background border border-border rounded-full shadow-lg px-4 py-2 flex items-center gap-3 max-w-xs mx-4">
        {/* 새 메시지 개수 */}
        <div className="flex-shrink-0">
          <div className="bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center">
            {newMessageCount > 99 ? '99+' : newMessageCount}
          </div>
        </div>

        {/* 메시지 미리보기 */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={handleClick}
        >
          <div className="text-sm text-foreground truncate">
            {lastMessagePreview || '새 메시지'}
          </div>
        </div>

        {/* 아래 화살표 버튼 */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 flex-shrink-0 hover:bg-muted"
          onClick={handleClick}
          aria-label="새 메시지로 이동"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* 닫기 버튼 */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 flex-shrink-0 hover:bg-muted"
          onClick={handleDismiss}
          aria-label="알림 닫기"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
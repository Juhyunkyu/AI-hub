"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface MessageReadCountProps {
  /** 안 읽은 사람 수 (카카오톡 스타일) */
  unreadCount?: number;
  /** 메시지 발신자 여부 (발신자의 메시지에만 읽음 카운트 표시) */
  isOwnMessage?: boolean;
  /** 추가 스타일 클래스 */
  className?: string;
  /** 크기 변형 */
  variant?: 'default' | 'small' | 'large';
  /** 위치 */
  position?: 'bottom-right' | 'bottom-left' | 'inline';
}

/**
 * 카카오톡 스타일 메시지 읽음 카운트 컴포넌트
 * - 발신자의 메시지에만 표시
 * - 0이면 숨김 (모든 사람이 읽음)
 * - 1 이상이면 노란색 배경의 작은 숫자 표시
 */
export const MessageReadCount = memo<MessageReadCountProps>(({
  unreadCount = 0,
  isOwnMessage = false,
  className,
  variant = 'default',
  position = 'bottom-right'
}) => {
  // 조건부 렌더링: 자신의 메시지가 아니거나 읽지 않은 사람이 0명이면 숨김
  if (!isOwnMessage || unreadCount <= 0) {
    return null;
  }

  // 크기 변형 스타일
  const sizeStyles = {
    small: "text-xs px-1.5 py-0.5 min-w-[18px] h-[18px]",
    default: "text-xs px-2 py-1 min-w-[20px] h-[20px]",
    large: "text-sm px-2.5 py-1 min-w-[24px] h-[24px]"
  };

  // 위치 스타일
  const positionStyles = {
    'bottom-right': "absolute -bottom-1 -right-1",
    'bottom-left': "absolute -bottom-1 -left-1",
    'inline': "relative inline-flex"
  };

  return (
    <div
      className={cn(
        // 기본 스타일 (카카오톡 스타일)
        "flex items-center justify-center rounded-full bg-yellow-400 text-yellow-900 font-medium shadow-sm border border-yellow-300",
        // 크기 변형
        sizeStyles[variant],
        // 위치
        positionStyles[position],
        // 애니메이션
        "transition-all duration-200 ease-in-out",
        "animate-in slide-in-from-bottom-2 fade-in-50",
        // 호버 효과
        "hover:bg-yellow-500 hover:scale-105",
        // 커스텀 클래스
        className
      )}
      // 접근성
      role="status"
      aria-label={`${unreadCount}명이 메시지를 읽지 않음`}
      title={`${unreadCount}명이 아직 이 메시지를 읽지 않았습니다`}
    >
      <span className="leading-none select-none">
        {unreadCount}
      </span>
    </div>
  );
});

MessageReadCount.displayName = "MessageReadCount";

// 메시지 읽음 상태 표시용 래퍼 컴포넌트
interface MessageReadStatusProps {
  /** 안 읽은 사람 수 */
  unreadCount?: number;
  /** 메시지 발신자 여부 */
  isOwnMessage?: boolean;
  /** 자식 컴포넌트 (메시지 컨테이너) */
  children: React.ReactNode;
  /** 읽음 카운트 위치 */
  countPosition?: 'bottom-right' | 'bottom-left';
  /** 추가 스타일 */
  className?: string;
}

/**
 * 메시지에 읽음 상태를 표시하는 래퍼 컴포넌트
 * 메시지 컨테이너를 감싸고 우하단에 읽음 카운트 배지를 표시
 */
export const MessageReadStatus = memo<MessageReadStatusProps>(({
  unreadCount,
  isOwnMessage = false,
  children,
  countPosition = 'bottom-right',
  className
}) => {
  return (
    <div className={cn("relative", className)}>
      {children}
      <MessageReadCount
        unreadCount={unreadCount}
        isOwnMessage={isOwnMessage}
        position={countPosition}
        variant="default"
      />
    </div>
  );
});

MessageReadStatus.displayName = "MessageReadStatus";

// 카카오톡 스타일 읽음 상태 인디케이터 (텍스트 형태)
interface ReadStatusTextProps {
  /** 안 읽은 사람 수 */
  unreadCount?: number;
  /** 메시지 발신자 여부 */
  isOwnMessage?: boolean;
  /** 표시 형식 */
  format?: 'count' | 'text' | 'both';
  /** 추가 스타일 */
  className?: string;
}

/**
 * 텍스트 형태의 읽음 상태 인디케이터
 * 메시지 하단에 "안 읽음 2" 형태로 표시
 */
export const ReadStatusText = memo<ReadStatusTextProps>(({
  unreadCount = 0,
  isOwnMessage = false,
  format = 'count',
  className
}) => {
  if (!isOwnMessage || unreadCount <= 0) {
    return null;
  }

  const getText = () => {
    switch (format) {
      case 'text':
        return `${unreadCount}명 안 읽음`;
      case 'both':
        return `안 읽음 ${unreadCount}명`;
      case 'count':
      default:
        return unreadCount.toString();
    }
  };

  return (
    <span
      className={cn(
        "text-xs text-yellow-600 font-medium",
        "transition-opacity duration-200",
        className
      )}
      aria-label={`${unreadCount}명이 메시지를 읽지 않음`}
    >
      {getText()}
    </span>
  );
});

ReadStatusText.displayName = "ReadStatusText";
"use client";

import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";

// 인기 이모지 24개 (3줄 × 8열 최적화)
const DEFAULT_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", // 1줄: 웃는 얼굴
  "😊", "😍", "🥰", "😘", "😋", "😎", "🤔", "😢", // 2줄: 감정 표현
  "😭", "😡", "👍", "👎", "👏", "🙏", "❤️", "🔥"  // 3줄: 인기 이모지
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  customEmojis?: string[];
  triggerComponent?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "ghost" | "default";
}

export interface EmojiPickerRef {
  close: () => void;
  open: () => void;
  toggle: () => void;
}

/**
 * 재사용 가능한 이모지 피커 컴포넌트
 * React 19 + Next.js 15 호환
 *
 * 주요 기능:
 * - 인기 이모지 24개 그리드 (8×3)
 * - 커스텀 이모지 리스트 지원
 * - 자동 닫기 + 포커스 복원
 * - 접근성 개선 (키보드 네비게이션)
 * - forwardRef로 외부 제어 가능
 */
export const EmojiPicker = forwardRef<EmojiPickerRef, EmojiPickerProps>(({
  onEmojiSelect,
  customEmojis,
  triggerComponent,
  className = "",
  disabled = false,
  size = "sm",
  variant = "outline"
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  // 사용할 이모지 리스트 (커스텀 우선, 없으면 기본값)
  const emojis = customEmojis || DEFAULT_EMOJIS;

  // 이모지 선택 핸들러 (React 19 최적화: useCallback)
  const handleEmojiSelect = useCallback((emoji: string) => {
    onEmojiSelect(emoji);

    // UX 개선: 이모지 선택 후 모달 자동 닫기
    setIsOpen(false);
  }, [onEmojiSelect]);

  // 외부 제어를 위한 ref 노출
  useImperativeHandle(ref, () => ({
    close: () => setIsOpen(false),
    open: () => setIsOpen(true),
    toggle: () => setIsOpen(prev => !prev)
  }), []);

  // 크기별 스타일
  const sizeClasses = {
    sm: "h-7 sm:h-8 px-2 text-[11px] sm:text-xs",
    md: "h-8 sm:h-9 px-3 text-xs sm:text-sm",
    lg: "h-9 sm:h-10 px-4 text-sm sm:text-base"
  };

  // 기본 트리거 컴포넌트
  const defaultTrigger = (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      className={`flex items-center gap-1 ${sizeClasses[size]} ${className}`}
    >
      <Smile className="h-3 w-3" />
      이모지
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerComponent || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 sm:w-96"
        side="bottom"
        align="start"
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={20}
        sticky="always"
        onOpenAutoFocus={(e) => {
          // 첫 번째 이모지 버튼에 포커스 (접근성 개선)
          e.preventDefault();
          const firstEmojiButton = e.currentTarget.querySelector('button');
          firstEmojiButton?.focus();
        }}
      >
        <div className="grid grid-cols-8 gap-1">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiSelect(emoji)}
              className="
                p-2 text-lg rounded transition-colors
                hover:bg-muted focus:bg-muted
                focus:outline-none focus:ring-2 focus:ring-ring
                active:scale-95 transition-transform
              "
              aria-label={`이모지 ${emoji} 선택`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

EmojiPicker.displayName = 'EmojiPicker';

// 기본 내보내기도 제공
export default EmojiPicker;
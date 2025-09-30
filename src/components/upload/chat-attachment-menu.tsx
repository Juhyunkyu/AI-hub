"use client";

import React, { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { toast } from "sonner";

// 개별 컴포넌트 import
import { GalleryOption } from "./gallery-option";
import { CameraOption } from "./camera-option";
import { FileOption } from "./file-option";
import { LocationOption } from "./location-option";
import { ChatAttachmentMenuProps, LocationData } from "./types";

export function ChatAttachmentMenu({
  onFileSelect,
  onLocationSelect,
  onError,
  disabled = false,
  className,
  children,
}: ChatAttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // 에러 처리
  const handleError = useCallback((error: string) => {
    toast.error(error);
    onError?.(error);
  }, [onError]);

  // 파일 선택 처리
  const handleFileSelect = useCallback((files: File[]) => {
    if (files.length > 0) {
      onFileSelect(files);
      setIsOpen(false);
      toast.success(`${files.length}개의 파일이 선택되었습니다.`);
    }
  }, [onFileSelect]);

  // 위치 선택 처리
  const handleLocationSelect = useCallback((location: LocationData) => {
    onLocationSelect?.(location);
    setIsOpen(false);
    toast.success("위치가 선택되었습니다.");
  }, [onLocationSelect]);

  // 메뉴 토글
  const toggleMenu = useCallback(() => {
    if (disabled) return;
    setIsOpen(!isOpen);
  }, [disabled, isOpen]);

  // 메뉴 옵션들
  const menuOptions = (
    <div className="space-y-1">
      {/* 갤러리 옵션 */}
      <GalleryOption
        onFileSelect={handleFileSelect}
        onError={handleError}
        disabled={disabled}
      />

      {/* 카메라 옵션 */}
      <CameraOption
        onFileSelect={handleFileSelect}
        onError={handleError}
        disabled={disabled}
      />

      {/* 파일 옵션 */}
      <FileOption
        onFileSelect={handleFileSelect}
        onError={handleError}
        disabled={disabled}
      />

      {/* 위치 공유 옵션 */}
      {onLocationSelect && (
        <LocationOption
          onLocationSelect={handleLocationSelect}
          onError={handleError}
          disabled={disabled}
        />
      )}
    </div>
  );

  // 트리거 버튼
  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleMenu}
      disabled={disabled}
      className={cn(
        "w-10 h-10 p-0 rounded-full",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isOpen && "bg-accent",
        className
      )}
      aria-label="첨부 메뉴 열기"
      aria-expanded={isOpen}
    >
      {isOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
    </Button>
  );

  // 모바일: Sheet 사용
  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="bottom"
            className="h-auto max-h-[80vh] rounded-t-2xl"
          >
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left">파일 첨부</SheetTitle>
            </SheetHeader>
            <div className="pb-6">
              {menuOptions}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // 데스크톱: Popover 사용
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        side="top"
        sideOffset={8}
      >
        {menuOptions}
      </PopoverContent>
    </Popover>
  );
}

// 커스텀 메뉴 (사용자 정의 옵션들)
export function CustomAttachmentMenu({
  options,
  disabled = false,
  className,
}: {
  options: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }>;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsOpen(!isOpen)}
      disabled={disabled}
      className={cn(
        "w-10 h-10 p-0 rounded-full",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isOpen && "bg-accent",
        className
      )}
    >
      {isOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
    </Button>
  );

  const menuContent = (
    <div className="space-y-1">
      {options.map((option) => (
        <Button
          key={option.id}
          variant="ghost"
          size="sm"
          onClick={() => {
            option.onClick();
            setIsOpen(false);
          }}
          disabled={option.disabled}
          className="flex items-center gap-2 w-full justify-start h-12 px-4"
        >
          {option.icon}
          <span className="text-sm">{option.label}</span>
        </Button>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="bottom"
            className="h-auto max-h-[80vh] rounded-t-2xl"
          >
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left">옵션 선택</SheetTitle>
            </SheetHeader>
            <div className="pb-6">
              {menuContent}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" side="top">
        {menuContent}
      </PopoverContent>
    </Popover>
  );
}
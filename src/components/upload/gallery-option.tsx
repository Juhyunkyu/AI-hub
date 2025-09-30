"use client";

import React, { useCallback, useRef } from "react";
import { ImageIcon, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GalleryOptionProps, FileTypes, FILE_SIZE_LIMITS } from "./types";

export function GalleryOption({
  onFileSelect,
  onError,
  disabled = false,
  className,
  accept = Object.keys(FileTypes.IMAGES).join(','),
  multiple = true,
  maxFiles = 10,
  maxSize = FILE_SIZE_LIMITS.IMAGE,
}: GalleryOptionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    // 파일 개수 제한 체크
    if (fileArray.length > maxFiles) {
      onError?.(maxFiles === 1
        ? "하나의 이미지만 선택할 수 있습니다."
        : `최대 ${maxFiles}개의 이미지만 선택할 수 있습니다.`
      );
      return [];
    }

    // 각 파일 검증
    for (const file of fileArray) {
      // 파일 크기 체크
      if (file.size > maxSize) {
        onError?.(`${file.name}의 크기가 너무 큽니다. (최대 ${Math.round(maxSize / 1024 / 1024)}MB)`);
        continue;
      }

      // 이미지 타입 체크
      if (!file.type.startsWith('image/')) {
        onError?.(`${file.name}는 이미지 파일이 아닙니다.`);
        continue;
      }

      validFiles.push(file);
    }

    return validFiles;
  }, [maxFiles, maxSize, onError]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = validateFiles(files);
    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }

    // 같은 파일을 다시 선택할 수 있도록 value 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validateFiles, onFileSelect]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  return (
    <>
      {/* 숨겨진 파일 입력 - 갤러리 전용 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-label="갤러리에서 이미지 선택"
      />

      {/* 갤러리 버튼 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 w-full justify-start h-12 px-4",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        aria-label="갤러리에서 이미지 선택"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
          <Images className="w-4 h-4" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">앨범</span>
          <span className="text-xs text-muted-foreground">
            갤러리에서 이미지 선택
          </span>
        </div>
      </Button>
    </>
  );
}

// 독립적으로 사용 가능한 간단한 갤러리 버튼
export function SimpleGalleryButton({
  onFileSelect,
  onError,
  disabled = false,
  className,
  multiple = true,
  maxFiles = 10,
}: Omit<GalleryOptionProps, 'accept' | 'maxSize'>) {
  return (
    <GalleryOption
      onFileSelect={onFileSelect}
      onError={onError}
      disabled={disabled}
      className={className}
      multiple={multiple}
      maxFiles={maxFiles}
      accept={Object.keys(FileTypes.IMAGES).join(',')}
      maxSize={FILE_SIZE_LIMITS.IMAGE}
    />
  );
}
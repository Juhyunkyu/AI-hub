"use client";

import React, { useCallback, useRef } from "react";
import { FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileOptionProps, FileTypes, FILE_SIZE_LIMITS } from "./types";

export function FileOption({
  onFileSelect,
  onError,
  disabled = false,
  className,
  accept = '*', // 모든 파일 타입 허용
  multiple = true,
  maxFiles = 5,
  maxSize = FILE_SIZE_LIMITS.DEFAULT,
}: FileOptionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    // 파일 개수 제한 체크
    if (fileArray.length > maxFiles) {
      onError?.(maxFiles === 1
        ? "하나의 파일만 선택할 수 있습니다."
        : `최대 ${maxFiles}개의 파일만 선택할 수 있습니다.`
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

      // 파일 이름 길이 체크 (너무 긴 파일명 방지)
      if (file.name.length > 255) {
        onError?.(`${file.name}의 파일명이 너무 깁니다.`);
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

  const getAcceptAttribute = useCallback(() => {
    if (accept === '*' || accept === FileTypes.ALL) {
      return undefined; // 모든 파일 허용
    }
    return accept;
  }, [accept]);

  return (
    <>
      {/* 숨겨진 파일 입력 - 모든 파일 타입 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptAttribute()}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-label="파일 선택"
      />

      {/* 파일 선택 버튼 */}
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
        aria-label="파일 선택"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">파일</span>
          <span className="text-xs text-muted-foreground">
            모든 파일 선택
          </span>
        </div>
      </Button>
    </>
  );
}

// 문서 전용 파일 선택기
export function DocumentFileOption({
  onFileSelect,
  onError,
  disabled = false,
  className,
  multiple = true,
  maxFiles = 3,
}: Omit<FileOptionProps, 'accept' | 'maxSize'>) {
  const documentAccept = Object.keys(FileTypes.DOCUMENTS).join(',');

  return (
    <FileOption
      onFileSelect={onFileSelect}
      onError={onError}
      disabled={disabled}
      className={className}
      accept={documentAccept}
      multiple={multiple}
      maxFiles={maxFiles}
      maxSize={FILE_SIZE_LIMITS.DOCUMENT}
    />
  );
}

// 첨부파일용 간단한 버튼 (아이콘만)
export function AttachmentButton({
  onFileSelect,
  onError,
  disabled = false,
  className,
}: Omit<FileOptionProps, 'accept' | 'multiple' | 'maxFiles' | 'maxSize'>) {
  return (
    <FileOption
      onFileSelect={onFileSelect}
      onError={onError}
      disabled={disabled}
      className={cn("w-auto px-2", className)}
      accept="*"
      multiple={true}
      maxFiles={5}
      maxSize={FILE_SIZE_LIMITS.DEFAULT}
    />
  );
}
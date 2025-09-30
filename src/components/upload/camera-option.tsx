"use client";

import React, { useCallback, useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CameraOptionProps, FileTypes, FILE_SIZE_LIMITS } from "./types";

export function CameraOption({
  onFileSelect,
  onError,
  disabled = false,
  className,
  captureMode = 'environment', // 기본적으로 후면 카메라
  accept = Object.keys(FileTypes.IMAGES).join(','),
}: CameraOptionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File) => {
    // 파일 크기 체크
    if (file.size > FILE_SIZE_LIMITS.IMAGE) {
      onError?.(`사진 크기가 너무 큽니다. (최대 ${Math.round(FILE_SIZE_LIMITS.IMAGE / 1024 / 1024)}MB)`);
      return false;
    }

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      onError?.('올바른 이미지 파일이 아닙니다.');
      return false;
    }

    return true;
  }, [onError]);

  const handleFileCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // 카메라는 보통 하나의 파일만 생성

    if (validateFile(file)) {
      onFileSelect([file]);
    }

    // 같은 파일을 다시 찍을 수 있도록 value 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validateFile, onFileSelect]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  return (
    <>
      {/* 숨겨진 파일 입력 - 카메라 전용 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        capture={captureMode} // 'user' = 전면 카메라, 'environment' = 후면 카메라
        onChange={handleFileCapture}
        style={{ display: 'none' }}
        aria-label="카메라로 사진 촬영"
      />

      {/* 카메라 버튼 */}
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
        aria-label="카메라로 사진 촬영"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
          <Camera className="w-4 h-4" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">사진 찍기</span>
          <span className="text-xs text-muted-foreground">
            카메라로 바로 촬영
          </span>
        </div>
      </Button>
    </>
  );
}

// 전면 카메라용 간단한 버튼 (셀카용)
export function SelfieCamera({
  onFileSelect,
  onError,
  disabled = false,
  className,
}: Omit<CameraOptionProps, 'captureMode' | 'accept'>) {
  return (
    <CameraOption
      onFileSelect={onFileSelect}
      onError={onError}
      disabled={disabled}
      className={className}
      captureMode="user" // 전면 카메라
      accept={Object.keys(FileTypes.IMAGES).join(',')}
    />
  );
}

// 후면 카메라용 간단한 버튼 (일반 촬영용)
export function BackCamera({
  onFileSelect,
  onError,
  disabled = false,
  className,
}: Omit<CameraOptionProps, 'captureMode' | 'accept'>) {
  return (
    <CameraOption
      onFileSelect={onFileSelect}
      onError={onError}
      disabled={disabled}
      className={className}
      captureMode="environment" // 후면 카메라
      accept={Object.keys(FileTypes.IMAGES).join(',')}
    />
  );
}
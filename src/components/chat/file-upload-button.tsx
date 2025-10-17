"use client";

import React, { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// 허용된 파일 타입 (보안 고려)
const ALLOWED_FILE_TYPES = [
  // 이미지
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // 문서
  'application/pdf',
  'text/plain',
  // 비디오 (작은 크기만)
  'video/mp4',
  'video/webm',
  // 오디오
  'audio/mp3',
  'audio/wav',
  'audio/mpeg'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * 채팅용 파일 업로드 버튼 컴포넌트
 * React 19 + Next.js 15 호환
 *
 * 주요 기능:
 * - 파일 크기 및 타입 검증
 * - 사용자 친화적 에러 메시지
 * - 접근성 개선
 * - forwardRef 미사용 (단순화)
 */
export function FileUploadButton({
  onFileSelect,
  disabled = false,
  variant = "ghost",
  size = "sm",
  className = ""
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 크기 포맷팅
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // 파일 유효성 검사
  const validateFile = useCallback((file: File): boolean => {
    // 파일 크기 검사
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`파일 크기가 너무 큽니다. 최대 ${formatFileSize(MAX_FILE_SIZE)}까지 업로드 가능합니다.`);
      return false;
    }

    // 파일 타입 검사
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error(`지원하지 않는 파일 형식입니다. (${file.type})`);
      return false;
    }

    // 파일명 길이 검사
    if (file.name.length > 255) {
      toast.error('파일명이 너무 깁니다. (최대 255자)');
      return false;
    }

    return true;
  }, [formatFileSize]);

  // 파일 선택 핸들러 - React 19 최적화
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 파일 유효성 검사
    if (!validateFile(file)) {
      // 입력값 리셋
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // 성공 시 파일 전달
    onFileSelect(file);

    // 입력값 리셋 (같은 파일 재선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileSelect, validateFile]);

  // 버튼 클릭 핸들러
  const handleButtonClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // 크기별 스타일
  const sizeClasses = {
    sm: "h-9 w-9 p-0",
    md: "h-10 w-10 p-0",
    lg: "h-11 w-11 p-0"
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={handleButtonClick}
        className={`shrink-0 ${sizeClasses[size]} ${className}`}
        aria-label="파일 업로드"
        title="파일 업로드 (최대 10MB)"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}

// 파일 메시지 미리보기 컴포넌트
interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    return '📎';
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg max-w-[calc(100vw-8rem)] overflow-hidden">
      <span className="text-lg shrink-0">{getFileIcon(file.type)}</span>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
        <p className="text-xs text-muted-foreground truncate">{formatFileSize(file.size)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-6 w-6 p-0 shrink-0"
        aria-label="파일 제거"
      >
        ×
      </Button>
    </div>
  );
}

export default FileUploadButton;
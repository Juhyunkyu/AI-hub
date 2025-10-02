"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Download, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  className?: string;
}

export function ImageLightbox({
  src,
  alt,
  isOpen,
  onClose,
  fileName,
  className,
}: ImageLightboxProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);

  // 라이트박스가 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setImageError(false);
      setRotation(0);
      setZoom(1);
    }
  }, [isOpen, src]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // 페이지 스크롤 막기
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // 이미지 다운로드
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || `image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("이미지 다운로드 실패:", error);
    }
  }, [src, fileName]);

  // 회전
  const handleRotateLeft = () => {
    setRotation((prev) => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation((prev) => prev + 90);
  };

  // 줌
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  // 줌 리셋
  const handleZoomReset = () => {
    setZoom(1);
    setRotation(0);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/90 backdrop-blur-sm" />
      <DialogContent
        className={cn(
          "max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-transparent overflow-hidden",
          className
        )}
        showCloseButton={false}
      >
        <div className="relative w-full h-full flex flex-col">
          {/* 상단 툴바 */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotateLeft}
              className="text-white hover:bg-white/20"
              aria-label="왼쪽으로 회전"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotateRight}
              className="text-white hover:bg-white/20"
              aria-label="오른쪽으로 회전"
            >
              <RotateCw className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-white/30" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="text-white hover:bg-white/20 disabled:opacity-50"
              aria-label="축소"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomReset}
              className="text-white hover:bg-white/20 text-xs px-2"
              aria-label="100%"
            >
              {Math.round(zoom * 100)}%
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="text-white hover:bg-white/20 disabled:opacity-50"
              aria-label="확대"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-white/30" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
              aria-label="다운로드"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* 닫기 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* 이미지 컨테이너 */}
          <div className="flex items-center justify-center w-full h-full min-h-[50vh] p-4">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {imageError ? (
              <div className="text-white text-center">
                <p className="text-lg mb-2">이미지를 불러올 수 없습니다</p>
                <p className="text-sm text-white/70">{src}</p>
              </div>
            ) : (
              <div
                className="relative transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                <Image
                  src={src}
                  alt={alt}
                  width={800}
                  height={600}
                  className="max-w-[90vw] max-h-[80vh] w-auto h-auto object-contain"
                  priority
                  unoptimized
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setImageError(true);
                  }}
                />
              </div>
            )}
          </div>

          {/* 파일명 표시 */}
          {fileName && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1">
              <p className="text-white text-sm max-w-[60vw] truncate">
                {fileName}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 이미지 클릭 가능한 컴포넌트
export interface ClickableImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fileName?: string;
  priority?: boolean;
  unoptimized?: boolean;
  onLoad?: () => void;
}

export function ClickableImage({
  src,
  alt,
  width = 300,
  height = 200,
  className,
  fileName,
  priority = false,
  unoptimized = true,
  onLoad,
}: ClickableImageProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLightboxOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "relative cursor-pointer group overflow-hidden rounded-lg",
          className
        )}
        onClick={handleImageClick}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="max-h-64 w-auto object-cover transition-transform group-hover:scale-105"
          priority={priority}
          unoptimized={unoptimized}
          onLoad={onLoad}
        />

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm bg-black/50 px-2 py-1 rounded">
            클릭하여 크게 보기
          </div>
        </div>
      </div>

      <ImageLightbox
        src={src}
        alt={alt}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        fileName={fileName}
      />
    </>
  );
}
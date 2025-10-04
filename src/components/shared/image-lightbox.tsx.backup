"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Download, RotateCcw, RotateCw, ZoomIn, ZoomOut,
  Pen, Eraser, Trash2, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Konva Canvas 컴포넌트 - useEffect로 동적 로딩
interface KonvaCanvasProps {
  stageRef: any;
  lines: DrawLine[];
  width: number;
  height: number;
  onMouseDown: (e: any) => void;
  onMouseMove: (e: any) => void;
  onMouseUp: () => void;
}

function KonvaCanvas({ stageRef, lines, width, height, onMouseDown, onMouseMove, onMouseUp }: KonvaCanvasProps) {
  const [Konva, setKonva] = useState<any>(null);

  useEffect(() => {
    // 동적으로 react-konva 로드
    import('react-konva').then((module) => {
      setKonva(module);
    });
  }, []);

  if (!Konva) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-white text-sm">캔버스 로딩 중...</div>
      </div>
    );
  }

  const { Stage, Layer, Line } = Konva;

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchStart={onMouseDown}
      onTouchMove={onMouseMove}
      onTouchEnd={onMouseUp}
    >
      <Layer>
        {lines.map((line, i) => (
          <Line
            key={i}
            points={line.points}
            stroke={line.tool === 'eraser' ? 'white' : line.color}
            strokeWidth={line.width}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={
              line.tool === 'eraser' ? 'destination-out' : 'source-over'
            }
          />
        ))}
      </Layer>
    </Stage>
  );
}

export interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  className?: string;
  onSend?: (imageDataUrl: string, fileName: string) => void;
  enableDrawing?: boolean;
}

interface DrawLine {
  tool: 'pen' | 'eraser';
  points: number[];
  color: string;
  width: number;
}

export function ImageLightbox({
  src,
  alt,
  isOpen,
  onClose,
  fileName,
  className,
  onSend,
  enableDrawing = true,
}: ImageLightboxProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // 펜 그리기 상태
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  // 캔버스 크기 (실제 렌더링된 이미지 크기에 맞춤)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // 이미지 ref
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<any>(null);

  // 라이트박스가 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setImageError(false);
      setRotation(0);
      setZoom(1);
      setShowControls(true);
      setIsDrawingMode(false);
      setLines([]);
      setIsDrawing(false);
      setTool('pen');
      setCanvasSize({ width: 800, height: 600 }); // 캔버스 크기 초기화
    }
  }, [isOpen, src]);

  // 이미지 로드 완료 시 실제 렌더링된 크기 측정
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);

    // 이미지가 로드된 후 실제 렌더링된 크기 측정
    if (imageRef.current) {
      const width = imageRef.current.offsetWidth;
      const height = imageRef.current.offsetHeight;

      // 유효한 크기인 경우에만 업데이트
      if (width > 0 && height > 0) {
        setCanvasSize({ width, height });
        console.log(`✅ Canvas size updated: ${width}x${height}`);
      }
    }
  }, []);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // 이미지 클릭 시 툴바 토글 (그리기 모드가 아닐 때만)
  const handleImageClick = useCallback(() => {
    if (!isDrawingMode) {
      setShowControls(!showControls);
    }
  }, [isDrawingMode, showControls]);

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

  const handleZoomReset = () => {
    setZoom(1);
    setRotation(0);
  };

  // 펜 모드 토글
  const handleToggleDrawing = () => {
    setIsDrawingMode(!isDrawingMode);
    if (!isDrawingMode) {
      setShowControls(true); // 펜 모드 진입 시 툴바 표시
    }
  };

  // Canvas 그리기 시작
  const handleMouseDown = (e: any) => {
    if (!isDrawingMode) return;

    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, {
      tool,
      points: [pos.x, pos.y],
      color: brushColor,
      width: brushSize
    }]);
  };

  // Canvas 그리기
  const handleMouseMove = (e: any) => {
    if (!isDrawing || !isDrawingMode) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();

    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    setLines([...lines.slice(0, -1), lastLine]);
  };

  // Canvas 그리기 종료
  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // 전체 지우기
  const handleClearDrawing = () => {
    setLines([]);
  };

  // 전송 기능
  const handleSend = useCallback(async () => {
    if (!onSend) return;

    try {
      // Canvas 생성
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 이미지 로드
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = src;

      img.onload = () => {
        // Canvas 크기 설정 (원본 이미지 크기)
        canvas.width = img.width;
        canvas.height = img.height;

        // 회전 변환
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();

        // 그림 추가
        if (lines.length > 0 && stageRef.current) {
          const stage = stageRef.current;
          const dataURL = stage.toDataURL();
          const drawImg = new window.Image();
          drawImg.src = dataURL;

          drawImg.onload = () => {
            // 스케일 비율 계산: 원본 이미지 크기 / Konva Stage 크기
            const scaleX = img.width / canvasSize.width;
            const scaleY = img.height / canvasSize.height;

            console.log(`📐 Scale ratios - X: ${scaleX.toFixed(2)}, Y: ${scaleY.toFixed(2)}`);
            console.log(`📏 Canvas: ${canvasSize.width}x${canvasSize.height}, Original: ${img.width}x${img.height}`);

            // 스케일 적용하여 그림 합성
            ctx.save();
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(drawImg, 0, 0);
            ctx.restore();

            // 최종 이미지 전송
            const finalDataURL = canvas.toDataURL('image/png');
            const finalFileName = fileName || `edited-${Date.now()}.png`;
            onSend(finalDataURL, finalFileName);
            onClose();
          };
        } else {
          // 그림이 없으면 회전만 적용된 이미지 전송
          const finalDataURL = canvas.toDataURL('image/png');
          const finalFileName = fileName || `rotated-${Date.now()}.png`;
          onSend(finalDataURL, finalFileName);
          onClose();
        }
      };
    } catch (error) {
      console.error('이미지 전송 실패:', error);
    }
  }, [src, rotation, lines, fileName, onSend, onClose, canvasSize]);

  if (!isOpen) return null;

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
  const brushSizes = [2, 4, 6, 8];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/90 backdrop-blur-sm z-[9999]" />
      <DialogContent
        className={cn(
          "max-w-[95vw] max-h-[95vh] w-fit h-fit p-0 border-0 bg-transparent overflow-visible z-[9999]",
          className
        )}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{fileName || alt}</DialogTitle>
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          {/* 상단 툴바 */}
          {showControls && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2 transition-opacity duration-200">
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

              {enableDrawing && (
                <>
                  <div className="w-px h-6 bg-white/30" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleDrawing}
                    className={cn(
                      "text-white hover:bg-white/20",
                      isDrawingMode && "bg-white/20"
                    )}
                    aria-label="펜 그리기"
                  >
                    <Pen className="h-4 w-4" />
                  </Button>
                </>
              )}

              {onSend && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSend}
                  className="text-white hover:bg-white/20"
                  aria-label="전송"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* 펜 툴바 (그리기 모드일 때만 표시) */}
          {showControls && isDrawingMode && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2 transition-opacity duration-200">
              {/* 펜/지우개 토글 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTool('pen')}
                className={cn(
                  "text-white hover:bg-white/20",
                  tool === 'pen' && "bg-white/20"
                )}
                aria-label="펜"
              >
                <Pen className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTool('eraser')}
                className={cn(
                  "text-white hover:bg-white/20",
                  tool === 'eraser' && "bg-white/20"
                )}
                aria-label="지우개"
              >
                <Eraser className="h-4 w-4" />
              </Button>

              <div className="w-px h-6 bg-white/30" />

              {/* 색상 선택 */}
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    brushColor === color ? "border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`색상 ${color}`}
                />
              ))}

              <div className="w-px h-6 bg-white/30" />

              {/* 굵기 선택 */}
              {brushSizes.map((size) => (
                <Button
                  key={size}
                  variant="ghost"
                  size="sm"
                  onClick={() => setBrushSize(size)}
                  className={cn(
                    "text-white hover:bg-white/20 w-8",
                    brushSize === size && "bg-white/20"
                  )}
                  aria-label={`굵기 ${size}px`}
                >
                  <div
                    className="rounded-full bg-white"
                    style={{ width: size, height: size }}
                  />
                </Button>
              ))}

              <div className="w-px h-6 bg-white/30" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearDrawing}
                className="text-white hover:bg-white/20"
                aria-label="전체 지우기"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 이미지 + Canvas 컨테이너 */}
          <div
            className="flex items-center justify-center w-full h-full min-h-[50vh] p-4 cursor-pointer"
            onClick={handleImageClick}
          >
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
              <div className="relative">
                {/* 이미지 */}
                <div
                  className="relative transition-transform duration-200 ease-out"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                >
                  <Image
                    ref={imageRef}
                    src={src}
                    alt={alt}
                    width={800}
                    height={600}
                    className="max-w-[90vw] max-h-[80vh] w-auto h-auto object-contain"
                    priority
                    unoptimized
                    onLoad={handleImageLoad}
                    onError={() => {
                      setIsLoading(false);
                      setImageError(true);
                    }}
                  />

                  {/* Canvas 오버레이 (그리기 모드일 때) */}
                  {isDrawingMode && typeof window !== 'undefined' && (
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-auto">
                      <KonvaCanvas
                        stageRef={stageRef}
                        lines={lines}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
  onSend?: (imageDataUrl: string, fileName: string) => void;
  enableDrawing?: boolean;
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
  onSend,
  enableDrawing = true,
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
        onSend={onSend}
        enableDrawing={enableDrawing}
      />
    </>
  );
}

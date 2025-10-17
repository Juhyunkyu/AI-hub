"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useResponsive } from "@/hooks/use-responsive";
import NextImage from "next/image";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LightboxHeader } from './lightbox-header';
import { LightboxFooter } from './lightbox-footer';
import { LightboxToolbar } from './lightbox-toolbar';
import { DrawingCanvas, type DrawLine } from './drawing-canvas';
import { FriendSelectionDialog } from './friend-selection-dialog';
import type { EditMode } from './toolbar-items/edit-toolbar';
import type { Stage } from 'konva/lib/Stage';

type ViewMode =
  | 'view'        // 기본: 작성자 정보 + 하단 기본 툴바
  | 'imageOnly'   // 이미지만 (UI 숨김)
  | 'editSelect'  // 편집 선택
  | 'editPen';    // 펜 편집 (다른 편집 모드는 추후 추가)

export interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  className?: string;
  onSend?: (imageDataUrl: string, fileName: string) => void;
  senderName?: string;
  senderAvatar?: string | null;
  sentAt?: string | Date;
  // Delete 기능을 위한 props
  messageId?: string;
  senderId?: string;
  currentUserId?: string;
  roomId?: string;
}

export function ImageLightbox({
  src,
  alt,
  isOpen,
  onClose,
  fileName = "image.png",
  onSend,
  senderName,
  senderAvatar,
  sentAt,
  messageId,
  senderId,
  currentUserId,
  roomId,
}: ImageLightboxProps) {
  // ==================== 상태 관리 ====================
  const { isMobile } = useResponsive();
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // 펜 그리기 상태
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [activeEditMode, setActiveEditMode] = useState<EditMode | null>(null);

  // 공유 다이얼로그 상태
  const [isFriendDialogOpen, setIsFriendDialogOpen] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<Stage | null>(null);

  // ==================== 초기화 ====================
  useEffect(() => {
    if (isOpen) {
      setViewMode('view');
      setLines([]);
      setIsDrawing(false);
      setTool('pen');
      setActiveEditMode(null);
    }
  }, [isOpen]);

  // 펜 모드 진입 시 캔버스 크기 재계산 (제거 - handleImageLoad에서 이미 설정됨)

  // 이미지 로드 시 캔버스 크기 설정 (실제 렌더링 크기 기준)
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    if (imageRef.current) {
      const width = imageRef.current.offsetWidth;
      const height = imageRef.current.offsetHeight;
      setCanvasSize({ width, height });
      console.log(`✅ Canvas size set to: ${width}x${height}`);
    }
  }, []);

  // ==================== 이미지 클릭 (UI 토글) ====================
  const handleImageClick = useCallback(() => {
    // 편집 모드에서는 클릭해도 아무 일도 안 일어남
    if (viewMode === 'editSelect' || viewMode === 'editPen') {
      return;
    }

    if (viewMode === 'view') {
      setViewMode('imageOnly');
    } else if (viewMode === 'imageOnly') {
      setViewMode('view');
    }
  }, [viewMode]);

  // ==================== 툴바 핸들러 ====================
  const handleDownload = useCallback(async () => {
    if (!stageRef.current || lines.length === 0) {
      // 그림이 없는 경우: 원본 다운로드
      const link = document.createElement('a');
      link.href = src;
      link.download = fileName;
      link.click();
      return;
    }

    // 그림이 있는 경우: 원본 이미지 + 그림 합성
    if (!imageRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 원본 이미지 로드
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // 캔버스 크기를 원본 이미지 크기로 설정
    canvas.width = img.width;
    canvas.height = img.height;

    // 1. 원본 이미지 그리기
    ctx.drawImage(img, 0, 0);

    // 2. Konva 캔버스에서 그림 추출
    const drawImg = new Image();
    drawImg.src = stageRef.current.toDataURL({ pixelRatio: 1 });

    await new Promise((resolve) => {
      drawImg.onload = resolve;
    });

    // 3. 스케일 비율 계산 (렌더링된 크기 vs 원본 크기)
    const scaleX = img.width / canvasSize.width;
    const scaleY = img.height / canvasSize.height;

    // 4. 그림을 원본 이미지 위에 합성
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(drawImg, 0, 0);
    ctx.restore();

    // 5. 다운로드
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = fileName;
    link.click();
  }, [src, fileName, lines, canvasSize]);

  const handleShare = useCallback(() => {
    setIsFriendDialogOpen(true);
  }, []);

  // 이미지 준비 함수 (그림이 있으면 합성, 없으면 원본)
  const prepareImageForSharing = useCallback(async (): Promise<string> => {
    // 그림이 없는 경우: 원본 이미지 URL 반환
    if (!stageRef.current || lines.length === 0) {
      return src;
    }

    // 그림이 있는 경우: 원본 이미지 + 그림 합성
    if (!imageRef.current) return src;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;

    // 원본 이미지 로드
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // 캔버스 크기를 원본 이미지 크기로 설정
    canvas.width = img.width;
    canvas.height = img.height;

    // 1. 원본 이미지 그리기
    ctx.drawImage(img, 0, 0);

    // 2. Konva 캔버스에서 그림 추출
    const drawImg = new Image();
    drawImg.src = stageRef.current.toDataURL({ pixelRatio: 1 });

    await new Promise((resolve) => {
      drawImg.onload = resolve;
    });

    // 3. 스케일 비율 계산 (렌더링된 크기 vs 원본 크기)
    const scaleX = img.width / canvasSize.width;
    const scaleY = img.height / canvasSize.height;

    // 4. 그림을 원본 이미지 위에 합성
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(drawImg, 0, 0);
    ctx.restore();

    // 5. Data URL 반환
    return canvas.toDataURL('image/png');
  }, [src, lines, canvasSize]);

  // 친구 선택 후 공유 처리
  const handleFriendSelection = useCallback(async (selectedFriendIds: string[]) => {
    try {
      // 이미지 준비
      const imageDataUrl = await prepareImageForSharing();

      // 각 친구에게 순차적으로 전송
      let successCount = 0;
      let failCount = 0;

      for (const friendId of selectedFriendIds) {
        try {
          // 1. 채팅방 찾기/생성
          const roomRes = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'direct',
              participant_ids: [friendId],
              name: null,
              description: null,
              avatar_url: null,
              is_private: false,
              max_participants: null,
            }),
          });

          if (!roomRes.ok) {
            failCount++;
            continue;
          }

          const roomData = await roomRes.json();
          const roomId = roomData.room?.id || roomData.room_id || roomData.id;

          // 2. 이미지 전송 (FormData 사용)
          const formData = new FormData();
          formData.append('room_id', roomId);
          formData.append('content', '이미지 공유');

          // Data URL을 Blob으로 변환
          if (imageDataUrl.startsWith('data:')) {
            const response = await fetch(imageDataUrl);
            const blob = await response.blob();
            formData.append('file', blob, fileName);
          } else {
            // 원본 URL인 경우 URL만 전송
            formData.append('file_url', imageDataUrl);
          }

          const messageRes = await fetch('/api/chat/messages', {
            method: 'POST',
            body: formData,
          });

          if (messageRes.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to share with friend ${friendId}:`, error);
          failCount++;
        }
      }

      // 결과 알림
      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount}명에게 이미지를 공유했습니다`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount}명에게 공유 성공, ${failCount}명 실패`);
      } else {
        toast.error('이미지 공유에 실패했습니다');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      toast.error('이미지 공유 중 오류가 발생했습니다');
    }
  }, [prepareImageForSharing, fileName]);

  const handleDelete = useCallback(async () => {
    // 🔍 DEBUG: Props 확인
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 handleDelete called with:', {
        messageId,
        currentUserId,
        roomId,
        senderId
      });
    }

    // 필수 props 확인
    if (!messageId || !currentUserId || !roomId) {
      console.error('❌ Missing required props:', { messageId, currentUserId, roomId });
      toast.error('메시지 정보가 없습니다');
      return;
    }

    // 삭제 확인 다이얼로그 (간소화)
    const confirmed = window.confirm('이 메시지를 삭제하시겠습니까?');

    if (!confirmed) return;

    try {
      const apiUrl = `/api/chat/messages/${messageId}`;
      console.log('🔍 DELETE API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      const result = await response.json();

      // 🔍 DEBUG: API 응답 확인
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 DELETE API response:', result);
      }

      if (result.success) {
        if (result.delete_type === 'soft') {
          toast.success('메시지가 숨겨졌습니다');

          // ✅ Soft Delete도 커스텀 이벤트 발생 (Realtime UPDATE가 불안정하므로)
          // API 응답의 updated_message로 직접 업데이트 처리
          if (result.updated_message) {
            window.dispatchEvent(new CustomEvent('chat-message-updated', {
              detail: result.updated_message
            }));
          }
        } else if (result.delete_type === 'hard') {
          toast.success('메시지가 삭제되었습니다');

          // ✅ Hard Delete는 Admin Client 사용으로 Realtime 이벤트가 트리거되지 않으므로
          // API 응답의 deleted_message_id로 직접 삭제 처리
          if (result.deleted_message_id) {
            window.dispatchEvent(new CustomEvent('chat-message-deleted', {
              detail: { messageId: result.deleted_message_id }
            }));
          }
        }

        // 라이트박스 닫기
        onClose();
      } else {
        toast.error('메시지 삭제에 실패했습니다');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('메시지 삭제 중 오류가 발생했습니다');
    }
  }, [messageId, senderId, currentUserId, roomId, onClose]);

  const handleEdit = useCallback(() => {
    setViewMode('editSelect');
  }, []);

  const handleEditModeChange = useCallback((mode: EditMode) => {
    setActiveEditMode(mode);
    if (mode === 'pen') {
      setViewMode('editPen');
    }
    // 다른 모드들은 추후 구현
  }, []);

  const handleBack = useCallback(() => {
    if (viewMode === 'editPen') {
      setViewMode('editSelect');
      setActiveEditMode(null);
    } else if (viewMode === 'editSelect') {
      setViewMode('view');
      setActiveEditMode(null);
    }
  }, [viewMode]);

  const handleClearAllDrawing = useCallback(() => {
    setLines([]);

    // Konva 캔버스에서 실제로 그려진 모든 도형 및 픽셀 제거
    if (stageRef.current) {
      const layers = stageRef.current.getLayers();
      layers.forEach((layer) => {
        layer.destroyChildren();  // 모든 도형 노드 제거
        layer.clear();             // 캔버스 픽셀 완전 클리어
        layer.draw();              // 레이어 다시 그리기
      });
      console.log(`✅ ${layers.length} Canvas layers cleared`);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!onSend) return;

    // 그림이 없는 경우: 원본 이미지 전송
    if (!stageRef.current || lines.length === 0) {
      onSend(src, fileName);
      onClose();
      return;
    }

    // 그림이 있는 경우: 원본 이미지 + 그림 합성
    if (!imageRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 원본 이미지 로드
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // 캔버스 크기를 원본 이미지 크기로 설정
    canvas.width = img.width;
    canvas.height = img.height;

    // 1. 원본 이미지 그리기
    ctx.drawImage(img, 0, 0);

    // 2. Konva 캔버스에서 그림 추출
    const drawImg = new Image();
    drawImg.src = stageRef.current.toDataURL({ pixelRatio: 1 });

    await new Promise((resolve) => {
      drawImg.onload = resolve;
    });

    // 3. 스케일 비율 계산 (렌더링된 크기 vs 원본 크기)
    const scaleX = img.width / canvasSize.width;
    const scaleY = img.height / canvasSize.height;

    // 4. 그림을 원본 이미지 위에 합성
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(drawImg, 0, 0);
    ctx.restore();

    // 5. 전송
    const uri = canvas.toDataURL('image/png');
    onSend(uri, fileName);
    onClose();
  }, [onSend, fileName, onClose, src, lines, canvasSize]);

  // ==================== 그리기 핸들러 ====================
  const handleMouseDown = useCallback((e: any) => {
    if (viewMode !== 'editPen') return;

    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const lineWidth = tool === 'eraser' ? 20 : 3;  // 지우개는 20px, 펜은 3px
    setLines([...lines, { tool, points: [pos.x, pos.y], color, width: lineWidth }]);
  }, [viewMode, lines, tool, color]);

  const handleMouseMove = useCallback((e: any) => {
    if (!isDrawing || viewMode !== 'editPen') return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];

    lastLine.points = lastLine.points.concat([point.x, point.y]);
    setLines(lines.slice(0, lines.length - 1).concat(lastLine));
  }, [isDrawing, viewMode, lines]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // ==================== 렌더링 ====================
  const isDrawingMode = viewMode === 'editPen';
  const showUI = viewMode !== 'imageOnly';
  const showSendButton = viewMode === 'editPen' || viewMode === 'editSelect';
  const showHeader = viewMode === 'view' && senderName;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-black/95" />
      <DialogContent
        className="max-w-none max-h-none w-screen h-screen p-0 bg-black border-none rounded-none overflow-hidden flex flex-col"
        aria-describedby="image-dialog-description"
      >
        <DialogTitle className="sr-only">이미지 보기</DialogTitle>
        <div id="image-dialog-description" className="sr-only">
          이미지를 확대하거나 편집할 수 있습니다
        </div>

        {/* Header */}
        <div className="flex-none relative">
          {/* 헤더: 작성자 정보 */}
          {showHeader && (
            <LightboxHeader
              senderName={senderName}
              senderAvatar={senderAvatar}
              sentAt={sentAt || new Date()}
              visible={showUI}
            />
          )}

          {/* 닫기 버튼 (항상 표시) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* 전송 버튼 (편집 모드에서만) */}
          {showSendButton && onSend && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSend}
              className="absolute top-4 right-16 z-30 bg-primary hover:bg-primary/90 text-white backdrop-blur-md"
            >
              <Send className="h-4 w-4 mr-2" />
              전송
            </Button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center"
             onClick={handleImageClick}>
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
              <div className="relative inline-block overflow-hidden">
                <NextImage
                  ref={imageRef}
                  src={src}
                  alt={alt}
                  width={1920}
                  height={1080}
                  className="max-w-full max-h-full w-auto h-auto object-contain block"
                  priority
                  unoptimized
                  onLoad={handleImageLoad}
                  onError={() => {
                    setIsLoading(false);
                    setImageError(true);
                  }}
                />

                {/* Canvas 오버레이 (펜 모드일 때) - 이미지와 정확히 같은 크기/위치 */}
                {isDrawingMode && typeof window !== 'undefined' && (
                  <DrawingCanvas
                    stageRef={stageRef}
                    lines={lines}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    rotation={0}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  />
                )}
              </div>
            )}
        </div>

        {/* Footer - Toolbar */}
        {showUI && (
          <LightboxFooter ariaLabel="이미지 편집 도구">
            <LightboxToolbar
              viewMode={viewMode}
              visible={showUI}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onBack={handleBack}
              activeEditMode={activeEditMode}
              onEditModeChange={handleEditModeChange}
              penTool={tool}
              penColor={color}
              onPenToolChange={setTool}
              onPenColorChange={setColor}
              onClearAllDrawing={handleClearAllDrawing}
            />
          </LightboxFooter>
        )}
      </DialogContent>

      {/* 친구 선택 다이얼로그 */}
      <FriendSelectionDialog
        isOpen={isFriendDialogOpen}
        onClose={() => setIsFriendDialogOpen(false)}
        onConfirm={handleFriendSelection}
      />
    </Dialog>
  );
}

// ==================== ClickableImage (기존 인터페이스 유지) ====================
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
  // Delete 기능을 위한 props
  messageId?: string;
  senderId?: string;
  currentUserId?: string;
  roomId?: string;
  // Sender 정보 (헤더 표시용)
  senderName?: string;
  senderAvatar?: string | null;
  sentAt?: string | Date;
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
  messageId,
  senderId,
  currentUserId,
  roomId,
  senderName,
  senderAvatar,
  sentAt,
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
        <NextImage
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
        messageId={messageId}
        senderId={senderId}
        currentUserId={currentUserId}
        roomId={roomId}
        senderName={senderName}
        senderAvatar={senderAvatar}
        sentAt={sentAt}
      />
    </>
  );
}

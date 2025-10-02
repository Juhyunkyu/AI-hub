"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  Image as ImageIcon,
  Video as VideoIcon,
  Link2,
  Code2,
  Loader2,
  X,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import {
  applyEditorCommand,
  insertLink,
  insertCodeBlock,
  sanitizeHtml,
  SelectionManager,
} from "@/lib/rich-editor-utils";
import {
  uploadImageToSupabase,
  uploadVideoToSupabase,
  validateImageFile,
  validateVideoFile,
  createImageHtml,
  createVideoHtml,
} from "@/lib/file-utils";
import { MapLocationPicker, LocationData } from "@/components/map";

export interface RichEditorToolbarProps {
  editorRef: React.RefObject<HTMLElement>;
  onContentChange?: (html: string) => void;
  showMapOption?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function RichEditorToolbar({
  editorRef,
  onContentChange,
  showMapOption = false,
  className = "",
  size = "md",
}: RichEditorToolbarProps) {
  const user = useAuthStore((s) => s.user);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoXhrRef = useRef<XMLHttpRequest | null>(null);
  const selectionManager = useRef<SelectionManager | null>(null);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // 선택 영역 관리자 초기화
  React.useEffect(() => {
    if (editorRef.current) {
      selectionManager.current = new SelectionManager(editorRef.current);
    }
  }, [editorRef]);

  // 컨텐츠 변경 시 콜백 호출
  const updateContent = useCallback(() => {
    if (editorRef.current && onContentChange) {
      const html = sanitizeHtml(editorRef.current.innerHTML);
      onContentChange(html);
    }
  }, [editorRef, onContentChange]);

  // 에디터 명령 실행
  const handleCommand = useCallback((cmd: string) => {
    applyEditorCommand(cmd, editorRef.current);
    updateContent();
  }, [editorRef, updateContent]);

  // 이미지 업로드 처리
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) return toast.error("로그인이 필요합니다");

    const validation = validateImageFile(file);
    if (!validation.valid) {
      return toast.error(validation.error);
    }

    setIsUploadingImage(true);
    try {
      const url = await uploadImageToSupabase(file, user.id);
      const html = createImageHtml(url);

      // 저장된 선택 영역 복원 후 삽입
      const savedRange = selectionManager.current?.getSavedRange();
      const { insertHtmlAtCursor } = await import("@/lib/rich-editor-utils");
      insertHtmlAtCursor(html, editorRef.current, savedRange);

      updateContent();
      toast.success("이미지가 삽입되었습니다");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error)?.message ?? "이미지 업로드 실패");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, [user, editorRef, updateContent]);

  // 비디오 업로드 처리
  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) return toast.error("로그인이 필요합니다");

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      return toast.error(validation.error);
    }

    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    toast("동영상 업로드가 진행 중입니다…");

    try {
      const { url } = await uploadVideoToSupabase(
        file,
        user.id,
        (progress) => setVideoUploadProgress(progress)
      );

      const html = createVideoHtml(url);

      // 저장된 선택 영역 복원 후 삽입
      const savedRange = selectionManager.current?.getSavedRange();
      const { insertHtmlAtCursor } = await import("@/lib/rich-editor-utils");
      insertHtmlAtCursor(html, editorRef.current, savedRange);

      updateContent();
      toast.success("동영상이 삽입되었습니다");
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as Error)?.message ?? "동영상 업로드 실패";
      toast.error(msg);
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);
      videoXhrRef.current = null;
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }, [user, editorRef, updateContent]);

  // 비디오 업로드 취소
  const cancelVideoUpload = useCallback(() => {
    if (videoXhrRef.current) {
      videoXhrRef.current.abort();
    }
    setIsUploadingVideo(false);
    setVideoUploadProgress(0);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }, []);

  // 링크 삽입
  const handleInsertLink = useCallback(() => {
    insertLink(editorRef.current);
    updateContent();
  }, [editorRef, updateContent]);

  // 코드 블록 삽입
  const handleInsertCodeBlock = useCallback(() => {
    insertCodeBlock(editorRef.current);
    updateContent();
  }, [editorRef, updateContent]);

  // 지도 위치 삽입
  const handleLocationSelect = useCallback(async (location: LocationData) => {
    const mapHtml = `<div class="map-location-card p-4 border border-border rounded-lg bg-muted/50 my-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-primary">📍</span>
        <span class="font-medium">${location.name}</span>
      </div>
      <div class="text-sm text-muted-foreground">${location.address}</div>
      ${location.phone ? `<div class="text-xs text-muted-foreground mt-1">📞 ${location.phone}</div>` : ''}
    </div>`;

    // 저장된 선택 영역 복원 후 삽입
    const savedRange = selectionManager.current?.getSavedRange();
    const { insertHtmlAtCursor } = await import("@/lib/rich-editor-utils");
    insertHtmlAtCursor(mapHtml, editorRef.current, savedRange);

    updateContent();
  }, [editorRef, updateContent]);


  // 선택 영역 저장
  const saveSelection = useCallback(() => {
    selectionManager.current?.saveSelection();
  }, []);

  // 아이콘 크기
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <TooltipProvider>
      <div className={`flex flex-wrap items-center gap-1 sm:gap-2 rounded border bg-muted/40 p-1.5 ${className}`}>
        {/* 텍스트 포맷팅 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="굵게"
              onClick={() => handleCommand("bold")}
              onMouseDown={saveSelection}
            >
              <Bold className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>굵게</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="기울임"
              onClick={() => handleCommand("italic")}
              onMouseDown={saveSelection}
            >
              <Italic className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>기울임</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="취소선"
              onClick={() => handleCommand("strikeThrough")}
              onMouseDown={saveSelection}
            >
              <Strikethrough className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>취소선</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="목록"
              onClick={() => handleCommand("insertUnorderedList")}
              onMouseDown={saveSelection}
            >
              <List className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>목록</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        {/* 미디어 삽입 */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="이미지"
              onClick={() => {
                saveSelection();
                imageInputRef.current?.click();
              }}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <ImageIcon className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>이미지</TooltipContent>
        </Tooltip>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoUpload}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="동영상"
              onClick={() => {
                saveSelection();
                videoInputRef.current?.click();
              }}
              disabled={isUploadingVideo}
            >
              {isUploadingVideo ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <VideoIcon className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>동영상</TooltipContent>
        </Tooltip>

        {isUploadingVideo && (
          <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>{videoUploadProgress}%</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="업로드 취소"
              onClick={cancelVideoUpload}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}


        <div className="w-px h-6 bg-border mx-1" />

        {/* 기타 도구 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="링크"
              onClick={() => {
                saveSelection();
                handleInsertLink();
              }}
            >
              <Link2 className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>링크</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="코드"
              onClick={() => {
                saveSelection();
                handleInsertCodeBlock();
              }}
            >
              <Code2 className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>코드 블록</TooltipContent>
        </Tooltip>

        {showMapOption && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="위치"
                onClick={() => {
                  saveSelection();
                  setShowMapPicker(true);
                }}
              >
                <MapPin className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>위치 공유</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* 지도 위치 선택 모달 */}
      {showMapOption && (
        <MapLocationPicker
          open={showMapPicker}
          onOpenChange={setShowMapPicker}
          onLocationSelect={handleLocationSelect}
        />
      )}
    </TooltipProvider>
  );
}

// 장소 선택 모달과 함께 사용하는 컴포넌트
export { RichEditorToolbar as default };
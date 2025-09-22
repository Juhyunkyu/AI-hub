"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
// import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { X, Send, Image as ImageIcon, Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface OptimisticCommentData {
  body: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  images: string[];
}

interface CommentFormProps {
  postId: string;
  postAuthorId: string;
  postAnonymous?: boolean;
  replyTo?: {
    commentId: string;
    authorUsername: string;
  };
  onCancelReply?: () => void;
  onSuccess?: () => void;
  onOptimisticSubmit?: (data: OptimisticCommentData, tempId: string) => void;
}

export function CommentForm({
  postId,
  postAuthorId,
  postAnonymous = false,
  replyTo,
  onCancelReply,
  onSuccess,
  onOptimisticSubmit,
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [emojiPage, setEmojiPage] = useState(0);
  const [isAnonymous, setIsAnonymous] = useState(postAnonymous);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const user = useAuthStore((s) => s.user);
  // const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [isPending, startTransition] = useTransition();

  // 인기 이모지 24개 (3줄 × 8열 최적화)
  const emojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", // 1줄: 웃는 얼굴
    "😊", "😍", "🥰", "😘", "😋", "😎", "🤔", "😢", // 2줄: 감정 표현
    "😭", "😡", "👍", "👎", "👏", "🙏", "❤️", "🔥"  // 3줄: 인기 이모지
  ];

  // 24개 인기 이모지로 8열 × 3줄 레이아웃
  const currentEmojis = emojis;

  // 답글 대상이 변경되면 텍스트 초기화
  useEffect(() => {
    if (replyTo) {
      setBody(`@${replyTo.authorUsername} `);
    } else {
      setBody("");
    }
  }, [replyTo]);

  // 이미지 압축 함수
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const img = new window.Image();

      img.onload = () => {
        // 최대 크기 설정 (800px)
        const maxSize = 800;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.8
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // 이미지 업로드 함수
  const handleImageUpload = async (files: FileList) => {
    if (images.length + files.length > 3) {
      toast.error("이미지는 최대 3개까지 업로드할 수 있습니다");
      return;
    }

    setUploadingImages(true);
    try {
      const compressedFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          const compressedFile = await compressImage(file);
          compressedFiles.push(compressedFile);
        }
      }

      setImages((prev) => [...prev, ...compressedFiles]);

      // 미리보기 URL 생성
      const newUrls = compressedFiles.map((file) => URL.createObjectURL(file));
      setImageUrls((prev) => [...prev, ...newUrls]);

      toast.success(`${compressedFiles.length}개의 이미지가 추가되었습니다`);
    } catch {
      toast.error("이미지 처리 중 오류가 발생했습니다");
    } finally {
      setUploadingImages(false);
    }
  };

  // 이미지 제거 함수
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 이모지 추가 함수 (UX 개선: 자동 닫기 + 포커스 복원)
  const addEmoji = (emoji: string) => {
    setBody((prev) => prev + emoji);

    // UX 개선: 이모지 선택 후 모달 자동 닫기
    setEmojiPopoverOpen(false);

    // 포커스를 텍스트 영역으로 복원 (약간의 지연을 두어 자연스럽게)
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  async function submit() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (!body.trim() && images.length === 0) return;
    if (loading) return; // 중복 제출 방지

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const currentBody = body.trim();
    const currentImages = [...images];
    const currentImageUrls = [...imageUrls];
    const currentReplyTo = replyTo;

    // Add optimistic comment immediately if handler is provided
    if (onOptimisticSubmit) {
      const optimisticCommentData: OptimisticCommentData = {
        body: currentBody,
        post_id: postId,
        author_id: user.id,
        parent_id: currentReplyTo?.commentId || null,
        images: [], // Will be populated after upload
      };
      
      // Use startTransition for better performance with optimistic updates
      startTransition(() => {
        onOptimisticSubmit(optimisticCommentData, tempId);
      });
    }

    // Clear form immediately for better UX
    setBody("");
    setImages([]);
    setImageUrls([]);
    
    setLoading(true);

    try {
      // 이미지 업로드
      const uploadedImageUrls: string[] = [];
      if (currentImages.length > 0) {
        for (const image of currentImages) {
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
          const { error } = await supabase.storage
            .from("comment-images")
            .upload(fileName, image);

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from("comment-images")
            .getPublicUrl(fileName);

          uploadedImageUrls.push(urlData.publicUrl);
        }
      }

      // 익명 게시글에서는 게시글 작성자가 무조건 익명으로 댓글 작성
      const isPostAuthor = user.id === postAuthorId;
      const finalIsAnonymous = postAnonymous ? (isPostAuthor ? true : isAnonymous) : isAnonymous;

      const commentData: {
        post_id: string;
        author_id: string;
        body: string;
        parent_id?: string;
        images?: string[];
        anonymous: boolean;
      } = {
        post_id: postId,
        author_id: user.id,
        body: currentBody,
        anonymous: finalIsAnonymous,
      };

      // 답글인 경우 parent_id 추가
      if (currentReplyTo) {
        commentData.parent_id = currentReplyTo.commentId;
      }

      // 이미지가 있는 경우 추가
      if (uploadedImageUrls.length > 0) {
        commentData.images = uploadedImageUrls;
      }

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || '댓글 작성 실패');
      }

      setBody("");
      setImages([]);
      setImageUrls([]);
      toast.success(
        currentReplyTo ? "답글이 작성되었습니다" : "댓글이 작성되었습니다"
      );

      // 콜백 함수 호출
      onSuccess?.();
    } catch (error: unknown) {
      // The useOptimistic hook in the parent component will automatically
      // rollback the optimistic comment when this promise rejects
      const message =
        error && typeof error === "object" && "message" in error
          ? ((error as { message?: string }).message ??
            "댓글 작성 중 오류가 발생했습니다")
          : "댓글 작성 중 오류가 발생했습니다";
      toast.error(message);
      
      // Restore form state on error for user to retry
      setBody(currentBody);
      setImages(currentImages);
      setImageUrls(currentImageUrls);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter로 댓글 작성
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-3">
      {/* 댓글 입력 폼 */}
      {user ? (
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={
                replyTo
                  ? `@${replyTo.authorUsername} 님에게 답글을 입력하세요...`
                  : "댓글을 입력하세요..."
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="resize-none text-[13px] sm:text-sm"
            />
            {replyTo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelReply}
                className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* 이미지 미리보기 */}
          {imageUrls.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`미리보기 ${index + 1}`}
                    className="w-20 h-20 object-cover rounded border"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-red-500 text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) =>
                  e.target.files && handleImageUpload(e.target.files)
                }
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImages || images.length >= 3}
                className="flex items-center gap-1 text-[11px] sm:text-xs h-7 sm:h-8 px-2"
              >
                <ImageIcon className="h-3 w-3" />
                이미지
              </Button>

              <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-[11px] sm:text-xs h-7 sm:h-8 px-2"
                  >
                    <Smile className="h-3 w-3" />
                    이모지
                  </Button>
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
                    {currentEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => addEmoji(emoji)}
                        className="w-8 h-8 text-lg hover:bg-muted rounded-md flex items-center justify-center transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {/* 페이지네이션 제거: 18개 이모지로 충분 */}
                </PopoverContent>
              </Popover>

              {/* 익명 체크박스 */}
              <label className="inline-flex items-center gap-1 text-[11px] sm:text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={postAnonymous && user?.id === postAuthorId ? true : isAnonymous}
                  onChange={(e) => {
                    // 익명 게시글에서 작성자는 체크박스 비활성화
                    if (postAnonymous && user?.id === postAuthorId) return;
                    setIsAnonymous(e.target.checked);
                  }}
                  disabled={postAnonymous && user?.id === postAuthorId}
                  className="w-3 h-3 sm:w-4 sm:h-4"
                />
                익명
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={submit}
                disabled={loading || isPending || (!body.trim() && images.length === 0)}
                size="sm"
                className="flex items-center gap-1 text-[11px] sm:text-xs h-7 sm:h-8 px-2"
              >
                <Send className="h-3 w-3" />
                {loading || isPending ? "작성 중..." : replyTo ? "답글 작성" : "댓글 작성"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded border p-3 bg-muted/50 text-center text-muted-foreground">
          로그인을 해야 댓글을 작성할 수 있습니다
        </div>
      )}
    </div>
  );
}

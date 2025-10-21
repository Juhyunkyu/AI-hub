"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Upload, User } from "lucide-react";
import {
  compressAvatar,
  formatFileSize,
  validateImageFile,
} from "@/lib/utils/image-compression";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onClose: () => void;
  onSuccess: (newUrl: string) => void;
}

export function AvatarUpload({
  currentAvatarUrl,
  onClose,
  onSuccess,
}: AvatarUploadProps) {
  const supabase = createSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: string;
    compressedSize: string;
    compressionRatio: number;
  } | null>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 유효성 검증
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      setUploading(true);

      // browser-image-compression으로 압축
      const result = await compressAvatar(file);

      // 압축 정보 표시
      setCompressionInfo({
        originalSize: formatFileSize(result.originalSize),
        compressedSize: formatFileSize(result.compressedSize),
        compressionRatio: result.compressionRatio,
      });

      // 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(result.file);
    } catch (error) {
      console.error("Image compression error:", error);
      toast.error("이미지 처리 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      toast.error("업로드할 파일을 선택해주세요");
      return;
    }

    const file = fileInputRef.current.files[0];

    try {
      setUploading(true);

      // browser-image-compression으로 압축
      const { file: compressedFile } = await compressAvatar(file);

      // 사용자 ID 가져오기
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("사용자 정보를 찾을 수 없습니다");
      }

      // 파일명 생성
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Supabase Storage에 업로드
      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, compressedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // 공개 URL 생성
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      // 프로필 업데이트
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      // 기존 아바타 삭제 (있는 경우)
      if (currentAvatarUrl) {
        try {
          const urlParts = currentAvatarUrl.split("/");
          const oldFileName = urlParts[urlParts.length - 1];
          if (oldFileName && oldFileName.includes("-")) {
            await supabase.storage.from("avatars").remove([oldFileName]);
          }
        } catch (error) {
          console.warn("기존 아바타 삭제 실패:", error);
        }
      }

      toast.success("프로필 사진이 업데이트되었습니다");
      onSuccess(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);

      // 더 구체적인 에러 메시지
      if (error instanceof Error) {
        if (error.message.includes("row-level security")) {
          toast.error("권한이 없습니다. 다시 로그인해주세요");
        } else if (error.message.includes("bucket")) {
          toast.error("스토리지 버킷에 접근할 수 없습니다");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("업로드 중 오류가 발생했습니다");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setUploading(true);

      // 프로필에서 아바타 URL 제거
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", (await supabase.auth.getUser()).data.user?.id);

      if (updateError) {
        throw updateError;
      }

      // 기존 아바타 파일 삭제
      if (currentAvatarUrl) {
        try {
          const urlParts = currentAvatarUrl.split("/");
          const fileName = urlParts[urlParts.length - 1];
          if (fileName && fileName.includes("-")) {
            await supabase.storage.from("avatars").remove([fileName]);
          }
        } catch (error) {
          console.warn("기존 아바타 삭제 실패:", error);
        }
      }

      toast.success("프로필 사진이 제거되었습니다");
      onSuccess("");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("프로필 사진 제거 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">프로필 사진 변경</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* 현재 아바타 또는 미리보기 */}
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-full border bg-muted overflow-hidden flex items-center justify-center">
              {preview ? (
                <img
                  src={preview}
                  alt="미리보기"
                  className="h-full w-full object-cover"
                />
              ) : currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt="현재 프로필 사진"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* 압축 정보 */}
          {compressionInfo && (
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <div>원본: {compressionInfo.originalSize}</div>
              <div>
                압축: {compressionInfo.compressedSize}
                {compressionInfo.compressionRatio > 0 && (
                  <span> ({compressionInfo.compressionRatio.toFixed(1)}% 감소)</span>
                )}
              </div>
            </div>
          )}

          {/* 파일 선택 */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              이미지 선택
            </Button>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex gap-2">
            {preview && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? "업로드 중..." : "업로드"}
              </Button>
            )}
            {currentAvatarUrl && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? "제거 중..." : "제거"}
              </Button>
            )}
          </div>

          {/* 안내 메시지 */}
          <div className="text-xs text-muted-foreground text-center">
            <p>• 최대 5MB까지 자동 압축됩니다</p>
            <p>• JPEG, PNG, WebP 형식을 지원합니다</p>
            <p>• 권장 크기: 512x512 픽셀</p>
          </div>
        </div>
      </div>
    </div>
  );
}

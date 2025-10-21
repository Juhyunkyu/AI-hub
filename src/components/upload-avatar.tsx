"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { compressAvatar, validateImageFile } from "@/lib/utils/image-compression";

const AVATARS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AVATARS || "posts";

export function UploadAvatar() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createSupabaseBrowserClient();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) return toast.error("로그인이 필요합니다");

    // 파일 유효성 검사
    const validation = validateImageFile(file, { maxSize: 10 * 1024 * 1024 });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setLoading(true);
    try {
      // browser-image-compression으로 압축
      const { file: compressedFile } = await compressAvatar(file);

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, compressedFile, {
          upsert: true,
          contentType: compressedFile.type,
          cacheControl: "3600",
        });

      if (upErr) {
        throw upErr;
      }

      const { data: urlData } = supabase.storage
        .from(AVATARS_BUCKET)
        .getPublicUrl(path);
      const url = urlData.publicUrl;

      const { error: up } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);

      if (up) {
        throw up;
      }

      toast.success("아바타가 업데이트되었습니다");
      router.refresh();
    } catch (err: unknown) {
      console.error("UploadAvatar: Error occurred:", err);
      toast.error((err as Error)?.message ?? "업로드 실패");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onSelectFile}
        className="hidden"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? "처리 중..." : "아바타 업로드"}
      </Button>
    </div>
  );
}

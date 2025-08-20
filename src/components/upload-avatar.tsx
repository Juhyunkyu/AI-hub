"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const AVATARS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AVATARS || "posts";

async function compressImage(
  file: File,
  maxSize = 512,
  quality = 0.8
): Promise<Blob> {
  const img = document.createElement("img");
  const reader = new FileReader();
  const load = new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error("read error"));
    reader.onload = () => resolve(reader.result as string);
  });
  reader.readAsDataURL(file);
  const dataUrl = await load;
  await new Promise<void>((res) => {
    img.onload = () => res();
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas ctx");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type.includes("png") ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), type, quality)
  );
  return blob;
}

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

    if (!/^image\//.test(file.type)) {
      toast.error("이미지 파일만 업로드할 수 있습니다");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("파일은 최대 5MB까지 지원합니다");
      return;
    }

    setLoading(true);
    try {
      const blob = await compressImage(file, 512, 0.85);

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;

      const { data: uploadData, error: upErr } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, {
          upsert: true,
          contentType: blob.type,
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

"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const AVATARS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AVATARS || "posts";

export function ProfileCover({
  userId,
  coverUrl,
}: {
  userId: string;
  coverUrl: string | null;
}) {
  const me = useAuthStore((s) => s.user);
  const isOwner = me?.id === userId;
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(coverUrl);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isOwner) return;
    if (!/^image\//.test(file.type)) return toast.error("이미지 파일만 가능");
    if (file.size > 5 * 1024 * 1024) return toast.error("최대 5MB");

    setLoading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `covers/${userId}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: up } = await supabase
        .from("profiles")
        .update({ links: { cover_url: publicUrl } })
        .eq("id", userId);
      if (up) throw up;
      setUrl(publicUrl);
      toast.success("커버가 업데이트되었습니다");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "업로드 실패");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative w-full h-28 sm:h-36 md:h-44 rounded-md overflow-hidden border bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="cover" className="h-full w-full object-cover" />
      ) : null}
      {isOwner && (
        <div className="absolute right-2 bottom-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSelect}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? "업로드 중..." : "커버 변경"}
          </Button>
        </div>
      )}
    </div>
  );
}

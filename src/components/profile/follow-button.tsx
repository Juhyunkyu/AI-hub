"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function FollowButton({ targetUserId }: { targetUserId: string }) {
  const supabase = createSupabaseBrowserClient();
  const user = useAuthStore((s) => s.user);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !targetUserId) return;
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      if (!cancelled && !error) setIsFollowing(Boolean(data));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, targetUserId, user]);

  async function toggle() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetUserId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "팔로우 처리 중 오류가 발생했습니다");
      }

      const result = await response.json();
      setIsFollowing(result.action === "followed");
      toast.success(result.action === "followed" ? "팔로우했습니다" : "언팔로우했습니다");
    } catch (e: any) {
      toast.error(e?.message ?? "실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  if (!user || user.id === targetUserId) {
    return null; // 본인은 팔로우 버튼 표시하지 않음
  }

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      className="h-8"
      onClick={toggle}
      disabled={loading}
    >
      {loading ? "..." : isFollowing ? "팔로잉중" : "팔로우"}
    </Button>
  );
}

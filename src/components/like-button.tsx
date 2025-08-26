"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function LikeButton({ targetId }: { targetId: string }) {
  const supabase = createSupabaseBrowserClient();
  const user = useAuthStore((s) => s.user);
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { count } = await supabase
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("target_type", "post")
        .eq("target_id", targetId);
      if (mounted) setCount(count ?? 0);

      if (user) {
        const { data } = await supabase
          .from("reactions")
          .select("id")
          .eq("target_type", "post")
          .eq("target_id", targetId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (mounted) setLiked(!!data);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [supabase, targetId, user]);

  async function toggle() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (liked) {
      setLiked(false);
      setCount((c) => c - 1);
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("target_type", "post")
        .eq("target_id", targetId)
        .eq("user_id", user.id);
      if (error) {
        setLiked(true);
        setCount((c) => c + 1);
        toast.error(error.message);
      }
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      const { error } = await supabase
        .from("reactions")
        .insert({ target_type: "post", target_id: targetId, user_id: user.id });
      if (error) {
        setLiked(false);
        setCount((c) => c - 1);
        toast.error(error.message);
      }
    }
  }

  return (
    <Button
      size="sm"
      variant={liked ? "default" : "outline"}
      onClick={toggle}
      aria-pressed={liked}
      className="h-7 sm:h-8 px-2 text-[11px] sm:text-xs"
    >
      <Heart
        className={`mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4 ${liked ? "fill-current" : ""}`}
      />{" "}
      {count}
    </Button>
  );
}

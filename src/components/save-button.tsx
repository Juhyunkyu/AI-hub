"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function SaveButton({ postId }: { postId: string }) {
  const supabase = createSupabaseBrowserClient();
  const user = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!user) return;
      const { data: coll } = await supabase
        .from("collections")
        .select("id")
        .eq("owner_id", user.id)
        .eq("name", "default")
        .maybeSingle();
      if (!coll) return;
      const { data } = await supabase
        .from("collection_items")
        .select("post_id")
        .eq("collection_id", coll.id)
        .eq("post_id", postId)
        .maybeSingle();
      if (mounted) setSaved(!!data);
    }
    init();
    return () => {
      mounted = false;
    };
  }, [supabase, user, postId]);

  async function toggle() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    const { data: coll } = await supabase
      .from("collections")
      .upsert({ owner_id: user.id, name: "default", is_public: false })
      .select("id")
      .maybeSingle();
    if (!coll) return;

    if (saved) {
      setSaved(false);
      const { error } = await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", coll.id)
        .eq("post_id", postId);
      if (error) {
        setSaved(true);
        toast.error(error.message);
      }
    } else {
      setSaved(true);
      const { error } = await supabase
        .from("collection_items")
        .insert({ collection_id: coll.id, post_id: postId });
      if (error) {
        setSaved(false);
        toast.error(error.message);
      }
    }
  }

  return (
    <Button
      size="sm"
      variant={saved ? "default" : "outline"}
      onClick={toggle}
      className="h-7 sm:h-8 px-2 text-[11px] sm:text-xs"
    >
      <Bookmark className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
      {saved ? "저장됨" : "저장"}
    </Button>
  );
}

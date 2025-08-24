"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PencilLine, Trash2 } from "lucide-react";

export function PostOwnerActions({ postId }: { postId: string }) {
  const router = useRouter();

  const handleEdit = () => {
    router.push(`/posts/new?edit=${postId}`);
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      "정말로 이 게시글을 삭제할까요? 이 작업은 되돌릴 수 없습니다."
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? "삭제 실패");
        return;
      }
      toast.success("삭제 완료");
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error("삭제 중 오류가 발생했습니다");
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleEdit}
        className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
      >
        <PencilLine className="h-3.5 w-3.5 mr-1 sm:h-4 sm:w-4" /> 수정
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1 sm:h-4 sm:w-4" /> 삭제
      </Button>
    </div>
  );
}

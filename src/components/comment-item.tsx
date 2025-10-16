"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Reply, Heart } from "lucide-react";
import { ReportButton } from "@/components/report-button";
import { AdminIcon } from "@/components/admin-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils/date-format";
import { CommentForm } from "./comment-form";

interface CommentItemProps {
  id: string;
  body: string;
  authorId: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  authorRole?: string;
  isNoticePost?: boolean;
  createdAt: string;
  isPostAuthor: boolean;
  postId: string;
  postAuthorId: string;
  postAnonymous?: boolean;
  isReply?: boolean;
  images?: string[];
  isOptimistic?: boolean;
  showActions?: boolean;
  onReply?: (commentId: string, authorUsername: string) => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function CommentItem({
  id,
  body,
  authorId,
  authorUsername,
  authorAvatarUrl,
  authorRole,
  isNoticePost = false,
  createdAt,
  isPostAuthor,
  postId,
  postAuthorId,
  postAnonymous = false,
  images = [],
  isOptimistic = false,
  showActions = true,
  onReply,
  onUpdate,
  onDelete,
}: CommentItemProps) {
  const user = useAuthStore((s) => s.user);
  const supabase = createSupabaseBrowserClient();
  const isOwner = user?.id === authorId;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [loading, setLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showReplyForm, setShowReplyForm] = useState(false);

  async function save() {
    if (!isOwner) return;
    if (!text.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from("comments")
      .update({ body: text })
      .eq("id", id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("수정되었습니다");
    setEditing(false);
    onUpdate?.();
  }

  async function remove() {
    if (!isOwner) return;
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    setLoading(true);
    const { error } = await supabase.from("comments").delete().eq("id", id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    onDelete?.();
  }

  async function toggleLike() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }

    try {
      if (liked) {
        // 좋아요 취소
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("target_type", "comment")
          .eq("target_id", id)
          .eq("user_id", user.id);

        if (error) throw error;
        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        // 좋아요 추가
        const { error } = await supabase.from("reactions").insert({
          target_type: "comment",
          target_id: id,
          user_id: user.id,
          type: "like",
        });

        if (error) throw error;
        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch {
      toast.error("좋아요 처리 중 오류가 발생했습니다");
    }
  }

  const handleReply = () => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    setShowReplyForm(true);
  };

  const handleReplyToBottom = () => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    onReply?.(id, authorUsername || "사용자");
  };

  return (
    <div className={`p-2.5 sm:p-3 border rounded-lg hover:bg-muted/50 transition-colors space-y-2 ${
      isOptimistic ? 'opacity-75 bg-blue-50/50 border-blue-200/50 dark:bg-blue-900/10 dark:border-blue-800/30' : ''
    }`}>
      {/* 헤더: 아바타, 사용자명, 배지, 메뉴 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {authorRole === "admin" && isNoticePost ? (
            <>
              <div className="h-7 w-7 rounded-full border bg-muted flex items-center justify-center flex-shrink-0">
                <AdminIcon className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                  관리자
                </span>
              </div>
            </>
          ) : (
            <UserAvatar
              userId={authorId}
              username={authorUsername}
              avatarUrl={authorAvatarUrl}
              size="sm"
              showActions={showActions}
              isOwner={false}
              showName={true}
            />
          )}
        </div>

        {/* 메뉴 버튼 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isOptimistic}
              className={`h-6 w-6 p-0 transition-opacity ${
                isOptimistic ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
              }`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && (
              <>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  수정
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={remove}
                  className="text-destructive"
                >
                  삭제
                </DropdownMenuItem>
              </>
            )}
            {!isOwner && (
              <DropdownMenuItem asChild>
                <ReportButton targetId={id} targetType="comment" />
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 댓글 내용 */}
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="text-[13px] sm:text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={loading}>
              저장
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setText(body);
              }}
              disabled={loading}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-[13px] sm:text-sm leading-relaxed">
          {body}
        </div>
      )}

      {/* 이미지 표시 */}
      {images && images.length > 0 && (
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {images.map((imageUrl, index) => (
            <Image
              key={index}
              src={`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`}
              alt={`댓글 이미지 ${index + 1}`}
              width={192}
              height={192}
              className="w-48 h-48 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.open(imageUrl, "_blank")}
            />
          ))}
        </div>
      )}

      {/* 날짜와 액션 버튼들 */}
      {!editing && (
        <div className="flex items-center gap-3 text-[11px] sm:text-xs text-muted-foreground">
          <span>
            {formatDate(createdAt)}
            {isOptimistic && (
              <span className="ml-2 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-medium">
                전송 중...
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleReply}
              disabled={isOptimistic}
              className={`flex items-center gap-1 transition-colors ${
                isOptimistic ? 'opacity-50 cursor-not-allowed' : 'hover:text-foreground'
              }`}
              title="바로 아래에 답글 작성"
            >
              <Reply className="h-3 w-3" />
              답글
            </button>
            <button
              onClick={toggleLike}
              disabled={isOptimistic}
              className={`flex items-center gap-1 transition-colors ${
                isOptimistic 
                  ? 'opacity-50 cursor-not-allowed' 
                  : liked 
                  ? "text-red-500" 
                  : "hover:text-foreground"
              }`}
            >
              <Heart className={`h-3 w-3 ${liked ? "fill-current" : ""}`} />
              {likeCount > 0 && likeCount}
            </button>
          </div>
        </div>
      )}

      {/* 인라인 답글 작성 폼 */}
      {showReplyForm && (
        <div className="mt-3 pl-4 sm:pl-8 border-l-2 border-muted/30">
          <CommentForm
            postId={postId}
            postAuthorId={postAuthorId}
            postAnonymous={postAnonymous}
            replyTo={{
              commentId: id,
              authorUsername: authorUsername || "사용자"
            }}
            onCancelReply={() => setShowReplyForm(false)}
            onSuccess={() => {
              setShowReplyForm(false);
              onUpdate?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

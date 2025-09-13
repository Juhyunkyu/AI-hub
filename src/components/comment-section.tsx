"use client";

/**
 * CommentSection with React 19 useOptimistic Hook Integration
 * 
 * This component implements optimistic UI updates for comments using React 19's useOptimistic hook.
 * When users submit comments or replies, they appear instantly in the UI while the server request 
 * is processed in the background. If the server request fails, the optimistic update is automatically 
 * rolled back.
 * 
 * Features:
 * - Instant comment submission feedback
 * - Automatic rollback on server errors
 * - Support for nested replies with optimistic updates
 * - Visual indicators for pending comments
 * - Backward compatibility with existing real-time updates
 */

import { useState, useOptimistic, useCallback } from "react";
import { CommentItem } from "./comment-item";
import { CommentForm } from "./comment-form";
import { Section } from "./section";
import { Comment, ProfileLite, CommentAction, OptimisticCommentData } from "@/types/comments";
import { useAuthStore } from "@/stores/auth";

interface CommentSectionProps {
  comments: Comment[];
  commentAuthors: ProfileLite[];
  postId: string;
  postAuthorId: string;
}

export function CommentSection({
  comments,
  commentAuthors,
  postId,
  postAuthorId,
}: CommentSectionProps) {
  const user = useAuthStore((s) => s.user);
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    authorUsername: string;
  } | null>(null);

  // Optimistic reducer function
  const optimisticReducer = (currentComments: Comment[], action: CommentAction): Comment[] => {
    switch (action.type) {
      case 'add':
        return [...currentComments, action.comment];
      case 'remove':
        return currentComments.filter(c => c.id !== action.commentId);
      case 'update':
        return currentComments.map(c => 
          c.id === action.commentId 
            ? { ...c, body: action.body }
            : c
        );
      default:
        return currentComments;
    }
  };

  // Initialize useOptimistic with comments from server
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    optimisticReducer
  );

  // Create a combined author map that includes current user for optimistic comments
  const commentAuthorById = new Map<string, ProfileLite>(
    commentAuthors.map((u) => [u.id, u])
  );
  
  // Add current user to author map for optimistic comments
  if (user && !commentAuthorById.has(user.id)) {
    commentAuthorById.set(user.id, {
      id: user.id,
      username: user.user_metadata?.username || user.email || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    });
  }

  // 댓글을 계층 구조로 구성
  const buildCommentTree = (comments: Comment[]) => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // 모든 댓글을 맵에 저장 (replies 배열 초기화)
    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // 댓글을 계층 구조로 구성
    comments.forEach((comment) => {
      if (comment.parent_id) {
        // 답글인 경우
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies!.push(commentMap.get(comment.id)!);
        }
      } else {
        // 최상위 댓글인 경우
        rootComments.push(commentMap.get(comment.id)!);
      }
    });

    return rootComments;
  };

  const commentTree = buildCommentTree(optimisticComments);

  const handleReply = (commentId: string, authorUsername: string) => {
    setReplyTo({ commentId, authorUsername });
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleCommentSuccess = () => {
    setReplyTo(null);
    // 부모 컴포넌트에서 데이터를 다시 가져오도록 함
    // window.location.reload() 대신 더 안전한 방법 사용
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Optimistic comment submission handler
  const handleOptimisticSubmit = useCallback((commentData: OptimisticCommentData, tempId: string) => {
    if (!user) return;
    
    const optimisticComment: Comment = {
      id: tempId,
      body: commentData.body,
      author_id: commentData.author_id,
      post_id: commentData.post_id,
      parent_id: commentData.parent_id,
      created_at: new Date().toISOString(),
      images: commentData.images || [],
      isOptimistic: true,
    };

    // Add the optimistic comment immediately
    addOptimisticComment({ type: 'add', comment: optimisticComment });
    
    return optimisticComment;
  }, [user, addOptimisticComment]);

  // 재귀적으로 댓글과 답글을 렌더링하는 함수
  const renderCommentTree = (commentList: Comment[], level: number = 0) => {
    return commentList.map((c) => {
      const commentAuthor = commentAuthorById.get(c.author_id);
      const isPostAuthor = c.author_id === postAuthorId;
      const isReply = level > 0;

      return (
        <div key={`${c.id}-${level}`} className="group">
          <div
            className={
              isReply
                ? "pl-4 sm:pl-8 border-l border-muted/30 sm:border-l-2"
                : ""
            }
          >
            <CommentItem
              id={c.id}
              body={c.body}
              authorId={c.author_id}
              authorUsername={commentAuthor?.username || null}
              authorAvatarUrl={commentAuthor?.avatar_url || null}
              createdAt={c.created_at}
              isPostAuthor={isPostAuthor}
              postId={postId}
              isReply={isReply}
              images={c.images || []}
              isOptimistic={c.isOptimistic}
              onReply={handleReply}
              onUpdate={handleCommentSuccess}
              onDelete={handleCommentSuccess}
            />
          </div>
          {/* 답글이 있으면 재귀적으로 렌더링 (모든 단계의 답글 표시) */}
          {c.replies && c.replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {renderCommentTree(c.replies, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Section
      title={<span className="text-sm sm:text-base">댓글</span>}
      className="space-y-2 sm:space-y-3"
    >
      <div className="space-y-2 sm:space-y-3">
        {renderCommentTree(commentTree)}
      </div>

      <div className="mt-4 sm:mt-6 mb-8 sm:mb-10">
        <CommentForm
          postId={postId}
          replyTo={replyTo || undefined}
          onCancelReply={handleCancelReply}
          onSuccess={handleCommentSuccess}
          onOptimisticSubmit={handleOptimisticSubmit}
        />
      </div>
    </Section>
  );
}

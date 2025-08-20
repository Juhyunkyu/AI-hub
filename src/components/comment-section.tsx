"use client";

import { useState } from "react";
import { CommentItem } from "./comment-item";
import { CommentForm } from "./comment-form";
import { Section } from "./section";

interface Comment {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  parent_id?: string | null;
  replies?: Comment[];
  images?: string[];
}

interface ProfileLite {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

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
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    authorUsername: string;
  } | null>(null);

  const commentAuthorById = new Map<string, ProfileLite>(
    commentAuthors.map((u) => [u.id, u])
  );

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

  const commentTree = buildCommentTree(comments);

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

  // 재귀적으로 댓글과 답글을 렌더링하는 함수
  const renderCommentTree = (commentList: Comment[], level: number = 0) => {
    return commentList.map((c) => {
      const commentAuthor = commentAuthorById.get(c.author_id);
      const isPostAuthor = c.author_id === postAuthorId;
      const isReply = level > 0;

      return (
        <div key={`${c.id}-${level}`} className="group">
          <div className={isReply ? "pl-8 border-l-2 border-muted/30" : ""}>
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
    <Section title="댓글">
      <div className="space-y-3">{renderCommentTree(commentTree)}</div>

      <div className="mt-6">
        <CommentForm
          postId={postId}
          replyTo={replyTo || undefined}
          onCancelReply={handleCancelReply}
          onSuccess={handleCommentSuccess}
        />
      </div>
    </Section>
  );
}

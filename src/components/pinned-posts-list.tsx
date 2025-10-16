import Link from "next/link";
import { Section } from "@/components/section";
import { PostAuthor } from "@/components/post-author";

type PinnedPost = {
  id: string;
  title: string;
  created_at: string;
  author_id: string;
  anonymous?: boolean;
  is_notice?: boolean;
};

type Author = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role?: string;
};

interface PinnedPostsListProps {
  posts: PinnedPost[];
  authorMap: Map<string, Author>;
  commentCountByPost: Map<string, number>;
  showGlobalLabel?: boolean;
  title?: string;
}

export function PinnedPostsList({
  posts,
  authorMap,
  commentCountByPost,
  showGlobalLabel = true,
  title,
}: PinnedPostsListProps) {
  if (posts.length === 0) return null;

  return (
    <Section title={title ? <span className="text-sm sm:text-base">{title}</span> : undefined}>
      <ul className="space-y-0.5">
        {posts.map((p) => (
          <li key={p.id} className="px-3 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/posts/${p.id}`}
                className="hover:underline font-bold truncate text-[11px] sm:text-xs flex items-baseline"
              >
                {showGlobalLabel && (
                  <span className="text-muted-foreground font-bold mr-2">
                    공지
                  </span>
                )}
                <span className="truncate">{p.title}</span>
                {(() => {
                  const n = commentCountByPost.get(p.id) || 0;
                  if (n <= 0) return null;
                  return (
                    <span className="ml-1 text-[10px] text-muted-foreground whitespace-nowrap">
                      {n > 99 ? "99+" : n}
                    </span>
                  );
                })()}
              </Link>
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground shrink-0">
                <PostAuthor
                  isNotice={p.is_notice ?? true}
                  isAnonymous={p.anonymous ?? false}
                  author={authorMap.get(p.author_id)}
                  size="sm"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

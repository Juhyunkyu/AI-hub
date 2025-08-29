"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { formatDate } from "@/lib/utils/date-format";

type PostItem = {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  post_type?: string;
};

type CommentItem = {
  id: string;
  body: string;
  post_id: string;
  created_at: string;
};

type ProfileItem = PostItem | CommentItem;

export function ProfileTabs({
  userId,
  isOwner,
  initialPosts = [],
  initialComments = [],
  initialSaved = [],
}: {
  userId: string;
  isOwner: boolean;
  initialPosts?: PostItem[];
  initialComments?: CommentItem[];
  initialSaved?: PostItem[];
}) {
  const [tab, setTab] = useState<"posts" | "saved" | "comments">("posts");
  const [items, setItems] = useState<ProfileItem[]>(initialPosts);
  const [filteredItems, setFilteredItems] =
    useState<ProfileItem[]>(initialPosts);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState({
    posts: initialPosts.length > 0,
    saved: initialSaved.length > 0,
    comments: initialComments.length > 0,
  });
  const [mounted, setMounted] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const me = useAuthStore((s) => s.user);

  // 클라이언트 마운트 후에만 렌더링
  useEffect(() => {
    setMounted(true);
  }, []);

  // 검색 필터링 함수
  const filterItems = (items: ProfileItem[], query: string) => {
    if (!query.trim()) return items;

    return items.filter((item) => {
      if (tab === "posts" || tab === "saved") {
        const post = item as PostItem;
        const searchText = query.toLowerCase();
        return (
          post.title.toLowerCase().includes(searchText) ||
          (post.content && post.content.toLowerCase().includes(searchText))
        );
      } else if (tab === "comments") {
        const comment = item as CommentItem;
        return comment.body.toLowerCase().includes(query.toLowerCase());
      }
      return false;
    });
  };

  // 검색어 변경 시 필터링
  useEffect(() => {
    setFilteredItems(filterItems(items, searchQuery));
  }, [searchQuery, items, tab]);

  // 탭 변경 시 데이터 설정
  useEffect(() => {
    if (tab === "posts") {
      setItems(initialPosts);
    } else if (tab === "saved") {
      setItems(initialSaved);
    } else if (tab === "comments") {
      setItems(initialComments);
    }
    // 탭 변경 시 검색어 초기화
    setSearchQuery("");
  }, [tab, initialPosts, initialComments, initialSaved]);

  // 초기 데이터가 없는 경우에만 API 호출
  useEffect(() => {
    async function load() {
      // 이미 데이터가 로드되었거나 초기 데이터가 있으면 스킵
      if (
        (tab === "posts" && hasLoaded.posts) ||
        (tab === "saved" && hasLoaded.saved) ||
        (tab === "comments" && hasLoaded.comments)
      ) {
        return;
      }

      setLoading(true);
      try {
        if (tab === "posts") {
          const { data } = await supabase
            .from("posts")
            .select("id,title,content,created_at,post_type")
            .eq("author_id", userId)
            .eq("status", "published")
            .order("created_at", { ascending: false });
          
          let posts = (data as PostItem[]) ?? [];
          
          // 다른 사용자 프로필에서는 익명 게시판 제외
          if (!isOwner) {
            posts = posts.filter(post => post.post_type !== 'anonymous');
          }
          
          setItems(posts);
          setHasLoaded((prev) => ({ ...prev, posts: true }));
        } else if (tab === "saved") {
          if (!isOwner) {
            setItems([]);
            setHasLoaded((prev) => ({ ...prev, saved: true }));
            return;
          }
          const { data } = await supabase
            .from("collection_items")
            .select(
              "posts(id,title,content,created_at,post_type), collections!inner(owner_id)"
            )
            .eq("collections.owner_id", userId)
            .order("created_at", { ascending: false });
          const savedPosts = (data as any[])?.map((item) => item.posts) ?? [];
          setItems(savedPosts);
          setHasLoaded((prev) => ({ ...prev, saved: true }));
        } else if (tab === "comments") {
          if (!isOwner) {
            setItems([]);
            setHasLoaded((prev) => ({ ...prev, comments: true }));
            return;
          }
          const { data } = await supabase
            .from("comments")
            .select("id,body,post_id,created_at")
            .eq("author_id", userId)
            .order("created_at", { ascending: false });
          setItems((data as CommentItem[]) ?? []);
          setHasLoaded((prev) => ({ ...prev, comments: true }));
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (mounted) {
      load();
    }
  }, [tab, userId, isOwner, mounted, hasLoaded, supabase]);

  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full bg-muted animate-pulse rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  // 공개 프로필인 경우 게시글 탭만 표시
  if (!isOwner) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Button size="sm" variant="default" className="h-8" disabled>
              작성
            </Button>
          </div>
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="작성 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-xs sm:text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 w-full bg-muted animate-pulse rounded"
              />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredItems.length === 0 ? (
              <li className="text-sm text-muted-foreground text-center py-4">
                {searchQuery
                  ? "검색 결과가 없습니다"
                  : "작성한 게시물이 없습니다"}
              </li>
            ) : (
              filteredItems.map((p) => (
                <li key={p.id} className="border rounded px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${p.id}`}
                      className="hover:underline font-medium truncate"
                    >
                      {(p as PostItem).title}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(p.created_at)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Button
            size="sm"
            variant={tab === "posts" ? "default" : "outline"}
            className="h-8"
            onClick={() => setTab("posts")}
          >
            작성
          </Button>
          <Button
            size="sm"
            variant={tab === "saved" ? "default" : "outline"}
            className="h-8"
            onClick={() => setTab("saved")}
          >
            저장
          </Button>
          <Button
            size="sm"
            variant={tab === "comments" ? "default" : "outline"}
            className="h-8"
            onClick={() => setTab("comments")}
          >
            댓글
          </Button>
        </div>
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              tab === "posts"
                ? "작성 검색..."
                : tab === "saved"
                  ? "저장 검색..."
                  : "댓글 검색..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-xs sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full bg-muted animate-pulse rounded"
            />
          ))}
        </div>
      ) : (
        <>
          {tab === "posts" && (
            <ul className="space-y-2">
              {filteredItems.length === 0 ? (
                <li className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery
                    ? "검색 결과가 없습니다"
                    : "작성한 게시물이 없습니다"}
                </li>
              ) : (
                filteredItems.map((p) => (
                  <li key={p.id} className="border rounded px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/posts/${p.id}`}
                        className="hover:underline font-medium truncate"
                      >
                        {(p as PostItem).title}
                      </Link>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(p.created_at)}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === "saved" && (
            <ul className="space-y-2">
              {filteredItems.length === 0 ? (
                <li className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery
                    ? "검색 결과가 없습니다"
                    : "저장한 게시물이 없습니다"}
                </li>
              ) : (
                filteredItems.map((p) => (
                  <li key={p.id} className="border rounded px-3 py-2">
                    <Link
                      href={`/posts/${p.id}`}
                      className="hover:underline font-medium truncate"
                    >
                      {(p as PostItem).title}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === "comments" && (
            <ul className="space-y-2">
              {filteredItems.length === 0 ? (
                <li className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery
                    ? "검색 결과가 없습니다"
                    : "작성한 댓글이 없습니다"}
                </li>
              ) : (
                filteredItems.map((c) => (
                  <li key={c.id} className="border rounded px-3 py-2">
                    <div className="space-y-1">
                      <Link
                        href={`/posts/${(c as CommentItem).post_id}`}
                        className="hover:underline font-medium text-sm"
                      >
                        {(c as CommentItem).body}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
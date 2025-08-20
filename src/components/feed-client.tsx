"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate } from "@/lib/utils/date-format";

export type TopicLite = { id: string; name: string };
export type TagLite = { id: string; name: string };

type PostLite = {
  id: string;
  title: string;
  created_at: string;
  author_id: string;
};

type SortMode = "latest" | "popular";

function mergeUniqueById(prev: PostLite[], next: PostLite[]): PostLite[] {
  const seen = new Set<string>(prev.map((p) => p.id));
  const merged = [...prev];
  for (const n of next) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      merged.push(n);
    }
  }
  return merged;
}

export function FeedClient({
  topics,
  tags,
  initialItems = [],
  authors = [],
  categoryId,
}: {
  topics: TopicLite[];
  tags: TagLite[];
  initialItems?: PostLite[];
  authors?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  }[];
  categoryId?: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const user = useAuthStore((s) => s.user);
  const [topicId, setTopicId] = useState<string | "">("");
  const [tagId, setTagId] = useState<string | "">("");
  const [sort, setSort] = useState<SortMode>("latest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [items, setItems] = useState<PostLite[]>(initialItems);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 작성자 정보를 Map으로 변환
  const authorMap = useMemo(() => {
    return new Map(authors.map((author) => [author.id, author]));
  }, [authors]);

  const fetchPage = useCallback(
    async (nextPage: number) => {
      const from = nextPage * 20;
      const to = from + 19;

      let baseIds: string[] | null = null;

      // 카테고리 필터링
      if (categoryId) {
        const { data: categoryTopics } = await supabase
          .from("topics")
          .select("id")
          .eq("category_id", categoryId);
        
        if (categoryTopics && categoryTopics.length > 0) {
          const topicIds = categoryTopics.map(t => t.id);
          const { data: mappings } = await supabase
            .from("post_topics")
            .select("post_id")
            .in("topic_id", topicIds);
          baseIds = (mappings ?? []).map((m) => m.post_id);
          if (baseIds.length === 0) return [] as PostLite[];
        } else {
          return [] as PostLite[];
        }
      }

      // 주제 필터링
      if (topicId) {
        const { data: mappings } = await supabase
          .from("post_topics")
          .select("post_id")
          .eq("topic_id", topicId);
        const topicIds = (mappings ?? []).map((m) => m.post_id);
        baseIds = baseIds
          ? baseIds.filter((id) => topicIds.includes(id))
          : topicIds;
        if (baseIds.length === 0) return [] as PostLite[];
      }

      // 태그 필터링
      if (tagId) {
        const { data: mappings } = await supabase
          .from("post_tags")
          .select("post_id")
          .eq("tag_id", tagId);
        const tagIds = (mappings ?? []).map((m) => m.post_id);
        baseIds = baseIds
          ? baseIds.filter((id) => tagIds.includes(id))
          : tagIds;
        if (baseIds.length === 0) return [] as PostLite[];
      }

      let query = supabase
        .from("posts")
        .select("id,title,created_at,author_id")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (baseIds) {
        query = supabase
          .from("posts")
          .select("id,title,created_at,author_id")
          .in("id", baseIds)
          .order("created_at", { ascending: false })
          .range(from, to);
      }

      if (q.trim()) {
        query = query.ilike("title", `%${q}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("feed fetch error", error);
        setErrorMessage(error.message ?? "피드 로드 실패");
        return [] as PostLite[];
      }
      setErrorMessage(null);
      const pageItems: PostLite[] = (data ?? []) as unknown as PostLite[];

      if (sort === "popular" && pageItems.length) {
        const ids = pageItems.map((p) => p.id);
        const { data: reacts } = await supabase
          .from("reactions")
          .select("target_id")
          .eq("target_type", "post")
          .in("target_id", ids);
        const countBy = new Map<string, number>();
        (reacts ?? []).forEach((r) => {
          const tid = (r as { target_id: string }).target_id;
          countBy.set(tid, (countBy.get(tid) ?? 0) + 1);
        });
        pageItems.sort(
          (a, b) => (countBy.get(b.id) ?? 0) - (countBy.get(a.id) ?? 0)
        );
      }

      return pageItems;
    },
    [supabase, tagId, topicId, sort, q, categoryId]
  );

  const load = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      const nextPage = reset ? 0 : page;
      const pageItems = await fetchPage(nextPage);
      if (reset) {
        setItems(pageItems);
        setPage(1);
      } else {
        setItems((prev) => mergeUniqueById(prev, pageItems));
        setPage((p) => p + 1);
      }
      setHasMore(pageItems.length === 20);
      setLoading(false);
      if (initialLoading) setInitialLoading(false);
    },
    [loading, page, fetchPage, initialLoading]
  );

  useEffect(() => {
    // If server provided initial items, skip the first fetch
    if (initialItems.length > 0) {
      setInitialLoading(false);
      setPage(1);
      return;
    }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, tagId, sort, q]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            load();
          }
        });
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, hasMore, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs block mb-1">키워드</label>
          <Input
            placeholder="제목으로 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs block mb-1">정렬</label>
          <div className="inline-flex gap-1">
            <Button
              variant={sort === "latest" ? "default" : "outline"}
              onClick={() => setSort("latest")}
            >
              최신
            </Button>
            <Button
              variant={sort === "popular" ? "default" : "outline"}
              onClick={() => setSort("popular")}
            >
              인기
            </Button>
          </div>
        </div>
        {topics.length > 0 && (
          <div>
            <label className="text-xs block mb-1">주제</label>
            <select
              className="h-9 rounded border px-2 bg-background"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              <option value="">전체</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <label className="text-xs block mb-1">태그</label>
            <select
              className="h-9 rounded border px-2 bg-background"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
            >
              <option value="">전체</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="ml-auto">
          {user ? (
            <Link href="/posts/new">
              <Button className="h-9">글 작성</Button>
            </Link>
          ) : null}
        </div>
      </div>
      {initialLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          {errorMessage ? (
            <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-3">
              {errorMessage}
            </div>
          ) : null}
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded p-4">
              결과가 없습니다.
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((p) => {
                const author = authorMap.get(p.author_id);
                return (
                  <li key={p.id} className="border rounded p-3">
                    <Link
                      href={`/posts/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <UserAvatar
                        userId={author?.id || p.author_id}
                        username={author?.username || null}
                        avatarUrl={author?.avatar_url || null}
                        size="sm"
                        showActions={true}
                        isOwner={false}
                        showName={true}
                      />
                      <span>· {formatDate(p.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <div ref={sentinelRef} />
    </div>
  );
}

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { User } from "lucide-react";

const PAGE_SIZE = 15;

export const revalidate = 15; // 댓글 수 빠른 반영을 위한 15초 ISR

export default async function AllPosts({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // 목록 페이지는 페이지 번호별로 ISR 캐시를 사용 (검색 없음)
  // noStore 미사용: 페이지 파라미터 단위로 캐싱됨
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user?.id);
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: posts, count } = await supabase
    .from("posts")
    .select("id,title,created_at,author_id,anonymous", { count: "exact" })
    .eq("is_notice", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const authorMap = new Map<
    string,
    { id: string; username: string | null; avatar_url: string | null }
  >();
  if (authorIds.length) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .in("id", authorIds);
    (authors ?? []).forEach((a) => {
      authorMap.set(
        (a as { id: string }).id,
        a as { id: string; username: string | null; avatar_url: string | null }
      );
    });
  }

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 카테고리 메타(홈과 동일 로직): post -> topic -> category
  const categoryByPost = new Map<string, { name: string; slug: string }>();
  const pagePostIds = (posts ?? []).map((p) => (p as { id: string }).id);
  if (pagePostIds.length) {
    const { data: mappings } = await supabase
      .from("post_topics")
      .select("post_id,topic_id")
      .in("post_id", pagePostIds);
    const firstTopicByPost = new Map<string, string>();
    (mappings ?? []).forEach((m) => {
      const pid = (m as { post_id: string }).post_id;
      if (!firstTopicByPost.has(pid)) {
        firstTopicByPost.set(pid, (m as { topic_id: string }).topic_id);
      }
    });
    const topicIds = Array.from(new Set(Array.from(firstTopicByPost.values())));
    if (topicIds.length) {
      const { data: topicsData } = await supabase
        .from("topics")
        .select("id,category_id")
        .in("id", topicIds);
      const topicToCategory = new Map<string, string>();
      (topicsData ?? []).forEach((t) => {
        topicToCategory.set(
          (t as { id: string }).id,
          (t as { category_id: string }).category_id as string
        );
      });
      const categoryIds = Array.from(
        new Set(Array.from(topicToCategory.values()).filter(Boolean))
      );
      if (categoryIds.length) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id,name,slug")
          .in("id", categoryIds);
        const catById = new Map<string, { name: string; slug: string }>();
        (cats ?? []).forEach((c) => {
          const id = (c as { id: string }).id;
          catById.set(id, {
            name: (c as { name: string }).name,
            slug: (c as { slug: string }).slug,
          });
        });
        Array.from(firstTopicByPost.entries()).forEach(([pid, tid]) => {
          const cid = topicToCategory.get(tid);
          if (cid) {
            const meta = catById.get(cid);
            if (meta) categoryByPost.set(pid, meta);
          }
        });
      }
    }
  }

  // 댓글 수 집계 (표시되는 게시글에 한정)
  const commentCountByPost = new Map<string, number>();
  if (pagePostIds.length) {
    const { data: commentRows } = await supabase
      .from("comments")
      .select("post_id")
      .in("post_id", pagePostIds);
    for (const r of commentRows ?? []) {
      const pid = (r as { post_id: string }).post_id;
      commentCountByPost.set(pid, (commentCountByPost.get(pid) || 0) + 1);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-0">
      <Section>
        <div className="mt-6 mb-4">
          <h1 className="text-base sm:text-lg font-semibold">최근 게시물</h1>
        </div>
        {!posts || posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-4">
              아직 게시물이 없습니다.
            </p>
            {isLoggedIn ? (
              <Link href="/posts/new">
                <Button>첫 번째 게시물 작성하기</Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {posts.map((p) => (
                <li key={p.id} className="border rounded px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${p.id}`}
                      className="hover:underline font-medium truncate text-sm sm:text-base flex items-baseline"
                    >
                      <span className="truncate">{p.title}</span>
                      {(() => {
                        const n = commentCountByPost.get(p.id) || 0;
                        if (n <= 0) return null;
                        return (
                          <span className="ml-1 text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">
                            {n > 99 ? "99+" : n}
                          </span>
                        );
                      })()}
                    </Link>
                    <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
                      {new Date(
                        p.created_at as unknown as string
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground flex items-center gap-2">
                    {(() => {
                      const cat = categoryByPost.get(p.id);
                      return cat ? (
                        <Link
                          href={`/categories/${cat.slug}`}
                          className="hover:underline"
                        >
                          {cat.name}
                        </Link>
                      ) : (
                        <span>기타</span>
                      );
                    })()}
                    {(() => {
                      const author = authorMap.get(p.author_id);
                      // anonymous 필드를 직접 접근
                      const postData = p as { anonymous?: boolean };
                      const isAnonymous = Boolean(postData.anonymous);
                      const name = isAnonymous
                        ? "익명"
                        : (author?.username ?? "익명");
                      const avatarUrl = isAnonymous
                        ? undefined
                        : (author?.avatar_url ?? undefined);
                      return (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar className="size-5">
                            <AvatarImage src={avatarUrl} alt={name} />
                            <AvatarFallback className="text-[10px]">
                              {isAnonymous ? (
                                <User className="h-3 w-3" />
                              ) : (
                                name.slice(0, 1)
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span>· {name}</span>
                        </span>
                      );
                    })()}
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    {currentPage > 1 && (
                      <PaginationItem>
                        <PaginationPrevious
                          href={`/posts?page=${currentPage - 1}`}
                        />
                      </PaginationItem>
                    )}
                    {(() => {
                      const items: (number | "ellipsis")[] = [];
                      const first = 1;
                      const last = totalPages;
                      const windowStart = Math.max(first + 1, currentPage - 1);
                      const windowEnd = Math.min(last - 1, currentPage + 1);
                      items.push(first);
                      if (windowStart > first + 1) items.push("ellipsis");
                      for (let p = windowStart; p <= windowEnd; p++)
                        items.push(p);
                      if (windowEnd < last - 1) items.push("ellipsis");
                      if (last > first) items.push(last);
                      return items.map((it, idx) =>
                        it === "ellipsis" ? (
                          <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={it}>
                            <PaginationLink
                              href={`/posts?page=${it}`}
                              isActive={it === currentPage}
                            >
                              {it}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      );
                    })()}
                    {currentPage < totalPages && (
                      <PaginationItem>
                        <PaginationNext
                          href={`/posts?page=${currentPage + 1}`}
                        />
                      </PaginationItem>
                    )}
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

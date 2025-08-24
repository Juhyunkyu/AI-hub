import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AdminIcon } from "@/components/admin-icon";

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { Section } from "@/components/section";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CategoryCard, Category } from "@/components/category-card";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";

export const revalidate = 60; // 60초 ISR

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = createSupabasePublicClient();
  const { q = "" } = await searchParams;
  const query = (q || "").trim();

  if (query.length >= 2) {
    noStore();
  }

  // 카테고리와 각 카테고리의 게시물 수 가져오기
  const [{ data: categories }, { data: recentPinnedGlobal }, { data: recent }] =
    await Promise.all([
      supabase
        .from("categories")
        .select(
          "id, slug, name, description, icon, color, sort_order, created_at"
        )
        .order("sort_order", { ascending: true }),
      supabase
        .from("posts")
        .select("id, title, created_at, author_id, pin_priority, pinned_until")
        .eq("pin_scope", "global")
        .or("pinned_until.is.null,pinned_until.gt." + new Date().toISOString())
        .order("pin_priority", { ascending: true })
        .order("pinned_until", { ascending: false })
        .limit(5),
      supabase
        .from("posts")
        .select("id, title, created_at, author_id")
        .eq("show_in_recent", true)
        .or("pin_scope.is.null,pin_scope.neq.global")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  // (생략) 카테고리별 카운트는 필요 시 추가 렌더링에 사용하세요

  // 최근 게시물 메타 정보(작성자/카테고리) 로딩
  const pinnedGlobal = (recentPinnedGlobal ?? []) as unknown as {
    id: string;
    title: string;
    created_at: string;
    author_id: string;
  }[];
  const recentPosts = (recent ?? []) as unknown as {
    id: string;
    title: string;
    created_at: string;
    author_id: string;
  }[];
  const recentAuthorIds = Array.from(
    new Set([...recentPosts, ...pinnedGlobal].map((r) => r.author_id))
  );
  const recentPostIds = [...recentPosts, ...pinnedGlobal].map((r) => r.id);

  // 작성자 맵
  const authorMap = new Map<
    string,
    { id: string; username: string | null; avatar_url: string | null }
  >();
  if (recentAuthorIds.length) {
    const { data: authorsData } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .in("id", recentAuthorIds);
    (authorsData ?? []).forEach((a) => {
      authorMap.set(
        (a as { id: string }).id,
        a as { id: string; username: string | null; avatar_url: string | null }
      );
    });
  }

  // 카테고리 맵(post -> { name, slug })
  const categoryByPost = new Map<string, { name: string; slug: string }>();
  if (recentPostIds.length) {
    const { data: mappings } = await supabase
      .from("post_topics")
      .select("post_id,topic_id")
      .in("post_id", recentPostIds);
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
        // map post -> category meta
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

  // 검색 처리 (홈 전역): 제목/본문 + 태그 이름
  let searchResults: Array<{
    id: string;
    title: string;
    content?: string | null;
    created_at: string;
    author_id: string;
    matchedByTag?: boolean;
  }> | null = null;
  if (query.length >= 2) {
    // 1) 제목/본문 매치
    const { data: byText } = await supabase
      .from("posts")
      .select("id,title,content,created_at,author_id")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    // 2) 태그 매치 → post_ids
    const { data: matchedTags } = await supabase
      .from("tags")
      .select("id")
      .ilike("name", `%${query}%`);
    const matchedTagIds = (matchedTags ?? []).map((t) => t.id as string);
    const tagPostIds = new Set<string>();
    if (matchedTagIds.length) {
      const { data: mappings } = await supabase
        .from("post_tags")
        .select("post_id,tag_id")
        .in("tag_id", matchedTagIds);
      for (const m of mappings ?? [])
        tagPostIds.add((m as { post_id: string }).post_id);
    }

    // 3) 통합 결과 (중복 제거, 최신순)
    const merged = new Map<
      string,
      {
        id: string;
        title: string;
        content?: string | null;
        created_at: string;
        author_id: string;
        matchedByTag?: boolean;
      }
    >();
    for (const p of (byText ?? []) as {
      id: string;
      title: string;
      content?: string | null;
      created_at: string;
      author_id: string;
    }[])
      merged.set(p.id, { ...p, matchedByTag: tagPostIds.has(p.id) });
    if (tagPostIds.size) {
      const { data: tagPosts } = await supabase
        .from("posts")
        .select("id,title,content,created_at,author_id")
        .in("id", Array.from(tagPostIds))
        .order("created_at", { ascending: false });
      for (const p of (tagPosts ?? []) as {
        id: string;
        title: string;
        content?: string | null;
        created_at: string;
        author_id: string;
      }[])
        merged.set(p.id, { ...p, matchedByTag: true });
    }
    searchResults = Array.from(merged.values());
  }

  return (
    <div className="font-sans space-y-6">
      {/* Introduction Section */}
      <div className="text-center py-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
          AI 지식 교류 허브
        </h1>
        <p className="text-sm text-muted-foreground mb-3">
          AI 관련 정보를 공유하고 토론하는 공간입니다.
        </p>
        {/* Search Bar */}
        <div className="max-w-md mx-auto">
          <SearchBar
            actionPath="/"
            initialQuery={query}
            placeholder="제목, 본문, 태그 검색..."
          />
        </div>
      </div>

      {query && searchResults && (
        <Section>
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">검색 결과</h2>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                검색 결과가 없습니다.
              </p>
            ) : (
              <ul className="space-y-3">
                {(() => {
                  const qLower = query.toLowerCase();
                  const escapeHtml = (s: string) =>
                    s
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#39;");
                  const regexSafe = query.replace(
                    /[.*+?^${}()|[\\]\\]/g,
                    "\\$&"
                  );
                  const highlight = (text: string) => {
                    const safe = escapeHtml(text || "");
                    if (!safe) return safe;
                    const re = new RegExp(`(${regexSafe})`, "gi");
                    return safe.replace(
                      re,
                      '<mark class="px-1 rounded bg-yellow-200/60">$1</mark>'
                    );
                  };
                  const stripHtml = (html: string) =>
                    (html || "")
                      .replace(/<[^>]*>/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                  return searchResults.map((p) => {
                    const contentText = stripHtml(p.content || "");
                    const contentLower = contentText.toLowerCase();
                    const titleLower = (p.title || "").toLowerCase();
                    const titleHas = titleLower.includes(qLower);
                    const contentHas = contentLower.includes(qLower);
                    let snippetHtml: string | null = null;
                    if (contentHas) {
                      const idx = contentLower.indexOf(qLower);
                      const start = Math.max(0, idx - 40);
                      const end = Math.min(
                        contentText.length,
                        idx + qLower.length + 40
                      );
                      const snippet = contentText.slice(start, end);
                      snippetHtml = highlight(
                        (start > 0 ? "… " : "") +
                          snippet +
                          (end < contentText.length ? " …" : "")
                      );
                    }
                    const tagOnly =
                      Boolean((p as { matchedByTag?: boolean }).matchedByTag) &&
                      !titleHas &&
                      !contentHas;
                    return (
                      <li key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/posts/${p.id}`}
                            className="hover:underline font-medium"
                            dangerouslySetInnerHTML={{
                              __html: highlight(p.title || ""),
                            }}
                          />
                          <div className="flex items-center gap-2">
                            {tagOnly && (
                              <span className="text-[10px] px-1 py-0.5 rounded border text-muted-foreground">
                                태그 일치
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {snippetHtml && (
                          <div
                            className="text-xs text-muted-foreground line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: snippetHtml }}
                          />
                        )}
                      </li>
                    );
                  });
                })()}
              </ul>
            )}
          </div>
        </Section>
      )}

      {/* Categories Section - Only visible on small screens (hide on search) */}
      {!query && (
        <div className="md:hidden -mt-2">
          <div className="grid grid-cols-3 gap-2">
            {/* First row: 3 cards */}
            {(categories ?? []).slice(0, 3).map((category) => (
              <CategoryCard
                key={category.id}
                category={category as Category}
                isMobile={true}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {/* Second row: 2 cards */}
            {(categories ?? []).slice(3, 5).map((category) => (
              <CategoryCard
                key={category.id}
                category={category as Category}
                isMobile={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pinned Global Section (hide on search) */}
      {!query && pinnedGlobal.length > 0 && (
        <Section>
          <ul className="space-y-2">
            {pinnedGlobal.map((p) => (
              <li key={p.id} className="rounded px-3 py-2 bg-muted/30">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/posts/${p.id}`}
                    className="hover:underline truncate text-[11px] sm:text-sm"
                  >
                    {p.title}
                  </Link>
                </div>
                <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-[10px] px-1 py-0.5 rounded border text-muted-foreground">
                    공지
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AdminIcon /> 관리자
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Recent Posts Section (hide on search) */}
      {!query && (
        <div>
          <Section>
            <div className="mt-1 mb-3">
              <h2 className="text-sm sm:text-base font-semibold">
                최근 게시물
              </h2>
            </div>
            <ul className="space-y-2">
              {recentPosts.map((p) => (
                <li key={p.id} className="border rounded px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${p.id}`}
                      className="hover:underline font-medium truncate text-sm sm:text-base"
                    >
                      {p.title}
                    </Link>
                    <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
                      {new Date(p.created_at).toLocaleDateString()}
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
                      const name = author?.username ?? "익명";
                      const avatarUrl = author?.avatar_url ?? undefined;
                      return (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar className="size-5">
                            <AvatarImage src={avatarUrl} alt={name} />
                            <AvatarFallback className="text-[10px]">
                              {name.slice(0, 1)}
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
            <div className="mt-6 mb-16">
              <Link href="/posts">
                <Button variant="outline" size="sm">
                  더 보기
                </Button>
              </Link>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

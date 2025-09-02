import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { SearchBar } from "@/components/search-bar";
import { Plus, Home, ChevronRight, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const revalidate = 15; // 댓글 수 빠른 반영 (검색 시에는 noStore)

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

type PostLite = {
  id: string;
  title: string;
  created_at: string;
  author_id: string;
  view_count?: number;
  comment_count?: number;
};

type PostLiteWithMeta = PostLite & {
  content?: string | null;
  matchedByTag?: boolean;
  anonymous?: boolean;
};

const POSTS_PER_PAGE = 15; // 메인 정책에 맞춰 페이지당 게시글 수

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { page = "1" } = sp;
  const q = (sp as Record<string, string | undefined>).q ?? "";
  const query = (q || "").trim();
  const hasQuery = query.length >= 2;
  if (hasQuery) {
    noStore();
  }
  const currentPage = parseInt(page);
  const offset = (currentPage - 1) * POSTS_PER_PAGE;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user?.id);

  // 카테고리 정보 가져오기
  const { data: category } = await supabase
    .from("categories")
    .select("id, slug, name, description, icon, color, sort_order, created_at")
    .eq("slug", slug)
    .single();

  if (!category) {
    notFound();
  }

  // 해당 카테고리의 주제에 속한 게시물들 가져오기 (페이지네이션/검색 적용)
  const { data: topics } = await supabase
    .from("topics")
    .select("id")
    .eq("category_id", category.id);

  const topicIds = (topics || []).map((t) => t.id);
  let posts: PostLiteWithMeta[] = [];
  let totalPosts = 0;

  if (topicIds.length > 0) {
    const { data: postTopicMappings } = await supabase
      .from("post_topics")
      .select("post_id")
      .in("topic_id", topicIds);

    if (postTopicMappings && postTopicMappings.length > 0) {
      const postIds = postTopicMappings.map((m) => m.post_id);
      // 카테고리 고정글 조회 (상단 영역)
      const { data: pinnedCategory } = await supabase
        .from("posts")
        .select(
          "id, title, content, created_at, author_id, pin_priority, pinned_until, anonymous"
        )
        .eq("pin_scope", "category")
        .eq("pinned_category_id", category.id)
        .or("pinned_until.is.null,pinned_until.gt." + new Date().toISOString())
        .order("pin_priority", { ascending: true })
        .order("pinned_until", { ascending: false });
      const pinnedIds = new Set(
        ((pinnedCategory ?? []) as unknown as { id: string }[]).map((p) => p.id)
      );
      // 검색이 있으면 제목/본문/태그로 필터링 (정확한 태그 매칭)
      let filteredIds = postIds.filter((id) => !pinnedIds.has(id));
      let matchedTagPostIds = new Set<string>();
      if (query.length >= 2) {
        const { data: byText } = await supabase
          .from("posts")
          .select("id")
          .in("id", postIds)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`);
        const textIds = new Set((byText ?? []).map((p) => p.id as string));

        const { data: matchedTags } = await supabase
          .from("tags")
          .select("id")
          .ilike("name", `%${query}%`);
        const matchedTagIds = (matchedTags ?? []).map((t) => t.id as string);
        if (matchedTagIds.length) {
          const { data: mappings } = await supabase
            .from("post_tags")
            .select("post_id,tag_id")
            .in("tag_id", matchedTagIds)
            .in("post_id", postIds);
          matchedTagPostIds = new Set(
            (mappings ?? []).map((m) => (m as { post_id: string }).post_id)
          );
        }
        filteredIds = postIds.filter(
          (id) => textIds.has(id) || matchedTagPostIds.has(id)
        );
      }

      // 전체 게시글 수 계산
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .in("id", filteredIds);
      totalPosts = count || 0;

      // 페이지네이션된 게시글 가져오기 (content 포함)
      const { data: postsData } = await supabase
        .from("posts")
        .select(
          "id, title, content, created_at, author_id, pin_scope, is_notice, anonymous"
        )
        .in("id", filteredIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1);
      const normPosts: PostLiteWithMeta[] = (
        (postsData || []) as unknown as (PostLite & {
          content?: string | null;
        })[]
      )
        .filter((p) => {
          const isNotice = Boolean(
            (p as unknown as { is_notice?: boolean }).is_notice
          );
          // 모든 공지글은 카테고리 페이지에서 제외 (공지사항 페이지에서만 노출)
          if (isNotice) return false;
          return true;
        })
        .map((p) => ({
          ...(p as unknown as PostLite & { content?: string | null }),
          matchedByTag: matchedTagPostIds.has(
            (p as unknown as { id: string }).id
          ),
        }));
      // 상단: 고정글 + 일반글 페이지 구간
      const pinnedPosts: PostLiteWithMeta[] = (
        (pinnedCategory || []) as unknown as (PostLite & {
          content?: string | null;
        })[]
      ).map((p) => ({
        ...p,
        matchedByTag: false,
      }));
      // 전역 고정글은 제외 (안전 장치)
      posts = [...pinnedPosts.filter(() => true), ...normPosts];
    }
  }

  // 작성자 정보 가져오기
  const authorIds = Array.from(new Set(posts.map((post) => post.author_id)));

  let authors: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  }[] = [];

  if (authorIds.length > 0) {
    const { data: authorsData } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", authorIds);
    authors = authorsData || [];
  }

  const authorMap = new Map(authors.map((author) => [author.id, author]));

  // 댓글 수 집계 (표시되는 게시글에 한정)
  const displayPostIds = posts.map((p) => p.id);
  const commentCountByPost = new Map<string, number>();
  if (displayPostIds.length) {
    const { data: commentRows } = await supabase
      .from("comments")
      .select("post_id")
      .in("post_id", displayPostIds);
    for (const r of commentRows ?? []) {
      const pid = (r as { post_id: string }).post_id;
      commentCountByPost.set(pid, (commentCountByPost.get(pid) || 0) + 1);
    }
  }

  // 페이지네이션 계산
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
  const maxVisiblePages = 5; // 최대 표시할 페이지 번호 수

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="bg-card">
        <div className="pt-1 pb-0">
          <nav className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground">
            <Link
              href="/"
              className="flex items-center hover:text-foreground transition-colors"
            >
              <Home className="h-3 w-3 mr-1" />홈
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{category.name}</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-4">
        {/* Header with Search and Write Button */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold mb-1">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-muted-foreground text-xs sm:text-sm line-clamp-1 sm:line-clamp-none sm:whitespace-normal">
                {category.description}
              </p>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none sm:w-80 lg:w-96">
              <SearchBar
                actionPath={`/categories/${category.slug}`}
                initialQuery={query}
                placeholder="이 카테고리에서 검색..."
              />
            </div>
            {isLoggedIn ? (
              <Link href={`/posts/new?category=${category.slug}`}>
                <Button className="gap-1 sm:gap-2 whitespace-nowrap px-1.5 py-1 sm:px-3 sm:py-2 text-[11px] sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  글쓰기
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        {/* Posts List */}
        <div className="space-y-0">
          {hasQuery && posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-xs sm:text-sm">
                검색 결과가 없습니다.
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-xs sm:text-sm mb-4">
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
              {/* Posts (상단 고정 포함) */}
              <div className="space-y-1">
                {posts.map((post) => {
                  const author = authorMap.get(post.author_id);
                  const qLower = query.toLowerCase();
                  const escapeHtml = (s: string) =>
                    (s || "")
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
                      '<mark class="px-1 rounded bg-muted/50">$1</mark>'
                    );
                  };
                  const stripHtml = (html: string) =>
                    (html || "")
                      .replace(/<[^>]*>/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                  const contentText = stripHtml(post.content || "");
                  const contentLower = contentText.toLowerCase();
                  const titleLower = (post.title || "").toLowerCase();
                  const titleHas = hasQuery && titleLower.includes(qLower);
                  const contentHas = hasQuery && contentLower.includes(qLower);
                  let snippetHtml: string | null = null;
                  if (hasQuery && contentHas) {
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
                    hasQuery &&
                    Boolean(post.matchedByTag) &&
                    !titleHas &&
                    !contentHas;
                  return (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="block p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {hasQuery ? (
                            <h3 className="font-medium text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-baseline">
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: highlight(post.title),
                                }}
                              />
                              {(() => {
                                const n = commentCountByPost.get(post.id) || 0;
                                if (n <= 0) return null;
                                return (
                                  <span className="ml-1 text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">
                                    {n > 99 ? "99+" : n}
                                  </span>
                                );
                              })()}
                            </h3>
                          ) : (
                            <h3 className="font-medium text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-baseline">
                              <span className="truncate">{post.title}</span>
                              {(() => {
                                const n = commentCountByPost.get(post.id) || 0;
                                if (n <= 0) return null;
                                return (
                                  <span className="ml-1 text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">
                                    {n > 99 ? "99+" : n}
                                  </span>
                                );
                              })()}
                            </h3>
                          )}
                          {hasQuery && snippetHtml && (
                            <div
                              className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-1"
                              dangerouslySetInnerHTML={{ __html: snippetHtml }}
                            />
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs sm:text-xs text-muted-foreground">
                            {tagOnly && (
                              <span className="text-[10px] px-1 py-0.5 rounded border text-muted-foreground">
                                태그 일치
                              </span>
                            )}
                            {(() => {
                              const isNotice = Boolean(
                                (post as unknown as { is_notice?: boolean })
                                  .is_notice
                              );
                              if (isNotice) {
                                return (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Avatar className="size-5">
                                      <AvatarImage
                                        src={undefined}
                                        alt="관리자"
                                      />
                                      <AvatarFallback className="text-[10px]">
                                        관
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>관리자</span>
                                  </span>
                                );
                              }
                              const isAnonymous = post.anonymous;
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
                                  <span>{name}</span>
                                </span>
                              );
                            })()}
                            <span className="text-[11px] sm:text-xs">
                              {new Date(
                                post.created_at as unknown as string
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      {currentPage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious
                            href={`/categories/${slug}?page=${currentPage - 1}`}
                          />
                        </PaginationItem>
                      )}
                      {(() => {
                        const items: (number | "ellipsis")[] = [];
                        const first = 1;
                        const last = totalPages;
                        const windowStart = Math.max(
                          first + 1,
                          currentPage - 1
                        );
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
                                href={`/categories/${slug}?page=${it}`}
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
                            href={`/categories/${slug}?page=${currentPage + 1}`}
                          />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

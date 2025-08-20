import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Home, ChevronRight } from "lucide-react";

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

const POSTS_PER_PAGE = 10; // 페이지당 게시글 수

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const { page = "1" } = await searchParams;
  const currentPage = parseInt(page);
  const offset = (currentPage - 1) * POSTS_PER_PAGE;

  const supabase = createSupabaseServerClient();

  // 카테고리 정보 가져오기
  const { data: category } = await supabase
    .from("categories")
    .select("id, slug, name, description, icon, color, sort_order, created_at")
    .eq("slug", slug)
    .single();

  if (!category) {
    notFound();
  }

  // 해당 카테고리의 주제에 속한 게시물들 가져오기 (페이지네이션 적용)
  const { data: topics } = await supabase
    .from("topics")
    .select("id")
    .eq("category_id", category.id);

  const topicIds = (topics || []).map((t) => t.id);
  let posts: PostLite[] = [];
  let totalPosts = 0;

  if (topicIds.length > 0) {
    const { data: postTopicMappings } = await supabase
      .from("post_topics")
      .select("post_id")
      .in("topic_id", topicIds);

    if (postTopicMappings && postTopicMappings.length > 0) {
      const postIds = postTopicMappings.map((m) => m.post_id);

      // 전체 게시글 수 계산
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .in("id", postIds);

      totalPosts = count || 0;

      // 페이지네이션된 게시글 가져오기
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, title, created_at, author_id")
        .in("id", postIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1);

      posts = postsData || [];
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
              <p className="text-muted-foreground text-xs sm:text-sm">
                {category.description}
              </p>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="게시물, 태그 검색..."
                className="pl-10 text-xs sm:text-sm"
              />
            </div>
            <Link href="/posts/new">
              <Button className="gap-2 whitespace-nowrap text-xs sm:text-sm">
                <Plus className="h-4 w-4" />
                글쓰기
              </Button>
            </Link>
          </div>
        </div>

        {/* Posts List */}
        <div className="space-y-0">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-xs sm:text-sm mb-4">
                아직 게시물이 없습니다.
              </p>
              <Link href="/posts/new">
                <Button>첫 번째 게시물 작성하기</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Posts */}
              <div className="space-y-1">
                {posts.map((post) => {
                  const author = authorMap.get(post.author_id);
                  return (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="block p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm sm:text-base text-foreground hover:text-primary transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          <div className="flex items-center gap-4 mt-2 text-xs sm:text-xs text-muted-foreground">
                            <span>{author?.username || "익명"}</span>
                            <span>
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
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Link href={`/categories/${slug}?page=${currentPage - 1}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                    >
                      이전
                    </Button>
                  </Link>

                  <div className="flex items-center gap-1">
                    {pageNumbers.map((pageNum) => (
                      <Link
                        key={pageNum}
                        href={`/categories/${slug}?page=${pageNum}`}
                      >
                        <Button
                          variant={
                            pageNum === currentPage ? "default" : "outline"
                          }
                          size="sm"
                        >
                          {pageNum}
                        </Button>
                      </Link>
                    ))}
                  </div>

                  <Link href={`/categories/${slug}?page=${currentPage + 1}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                    >
                      다음
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { CategoryCard, Category } from "@/components/category-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default async function Home() {
  const supabase = createSupabaseServerClient();

  // 카테고리와 각 카테고리의 게시물 수 가져오기
  const [{ data: categories }, { data: recent }] = await Promise.all([
    supabase
      .from("categories")
      .select(
        "id, slug, name, description, icon, color, sort_order, created_at"
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("posts")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // 각 카테고리의 게시물 수 계산 (카테고리의 주제에 속한 게시물만)
  const categoryPostCounts = await Promise.all(
    (categories || []).map(async (category) => {
      // 해당 카테고리의 주제들 가져오기
      const { data: topics } = await supabase
        .from("topics")
        .select("id")
        .eq("category_id", category.id);

      if (!topics || topics.length === 0) {
        return { categoryId: category.id, count: 0 };
      }

      const topicIds = topics.map((t) => t.id);

      // 해당 주제들에 속한 게시물 수 계산
      const { count } = await supabase
        .from("post_topics")
        .select("*", { count: "exact", head: true })
        .in("topic_id", topicIds);

      return { categoryId: category.id, count: count || 0 };
    })
  );

  const categoryMap = new Map(
    categoryPostCounts.map(({ categoryId, count }) => [categoryId, count])
  );

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
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="게시물, 태그 검색..."
            className="pl-10 text-sm placeholder:text-xs"
          />
        </div>
      </div>

      {/* Categories Section - Only visible on small screens */}
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

      {/* Recent Posts Section */}
      <div>
        <Section title="최근 게시물">
          <ul className="space-y-2">
            {(recent ?? []).map((p) => (
              <li key={p.id} className="border rounded px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/posts/${p.id}`}
                    className="hover:underline font-medium truncate"
                  >
                    {p.title}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(
                      p.created_at as unknown as string
                    ).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link href="/categories/free">
              <Button variant="outline" size="sm">
                더 보기
              </Button>
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}

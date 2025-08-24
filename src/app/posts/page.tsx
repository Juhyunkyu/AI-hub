import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
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

const PAGE_SIZE = 15;

export default async function AllPosts({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = createSupabaseServerClient();
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: posts, count } = await supabase
    .from("posts")
    .select("id,title,created_at,author_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const authorMap = new Map<string, { id: string; username: string | null }>();
  if (authorIds.length) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id,username")
      .in("id", authorIds);
    (authors ?? []).forEach((a) => {
      authorMap.set(
        (a as { id: string }).id,
        a as { id: string; username: string | null }
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
            <Link href="/posts/new">
              <Button>첫 번째 게시물 작성하기</Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {posts.map((p) => (
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
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
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
                    <span>
                      · {authorMap.get(p.author_id)?.username ?? "익명"}
                    </span>
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

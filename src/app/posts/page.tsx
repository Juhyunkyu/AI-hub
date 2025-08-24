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
} from "@/components/ui/pagination";

const PAGE_SIZE = 20;

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
                    <span>
                      작성자: {authorMap.get(p.author_id)?.username ?? "익명"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={
                          currentPage > 1
                            ? `/posts?page=${currentPage - 1}`
                            : undefined
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages })
                      .slice(0, 7)
                      .map((_, idx) => {
                        const pageNum = idx + 1;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href={`/posts?page=${pageNum}`}
                              isActive={pageNum === currentPage}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                    <PaginationItem>
                      <PaginationNext
                        href={
                          currentPage < totalPages
                            ? `/posts?page=${currentPage + 1}`
                            : undefined
                        }
                      />
                    </PaginationItem>
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

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

function isAdmin(userId: string | null): boolean {
  const allowed = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.length) return false;
  if (!userId) return false;
  return allowed.includes(userId);
}

export default async function NoticePage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canWrite = isAdmin(user?.id ?? null);

  // 관리자 공지 전용: (1) 관리자 작성 (2) '공지' 태그가 달린 글만
  let posts:
    | { id: string; title: string; created_at: string; author_id: string }[]
    | [] = [];
  const adminIds = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminIds.length) {
    // 1) '공지' 태그 ID 조회
    const { data: tags } = await supabase
      .from("tags")
      .select("id")
      .ilike("name", "%공지%")
      .limit(5);

    const tagIds = (tags ?? []).map((t) => (t as { id: string }).id);
    if (tagIds.length) {
      // 2) 태그 매핑으로 post_ids 수집
      const { data: mappings } = await supabase
        .from("post_tags")
        .select("post_id,tag_id")
        .in("tag_id", tagIds);
      const postIds = Array.from(
        new Set((mappings ?? []).map((m) => (m as { post_id: string }).post_id))
      );
      if (postIds.length) {
        // 3) 관리자 작성 + 공지 태그가 달린 글만 노출
        const { data } = await supabase
          .from("posts")
          .select("id,title,created_at,author_id")
          .in("id", postIds)
          .in("author_id", adminIds)
          .order("created_at", { ascending: false });
        posts = (data ?? []) as typeof posts;
      }
    }
  }

  // 작성자 표시
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
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

  return (
    <div className="min-h-screen bg-background">
      <Section title="공지사항">
        <div className="mt-6 mb-3 flex items-center justify-between">
          <div />
          {canWrite && (
            <Link href="/posts/new?tag=공지">
              <Button size="sm">글쓰기</Button>
            </Link>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">
              등록된 공지가 없습니다.
            </p>
          </div>
        ) : (
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
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {authorMap.get(p.author_id)?.username ?? "익명"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

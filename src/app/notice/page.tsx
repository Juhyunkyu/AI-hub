import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { AdminIcon } from "@/components/admin-icon";
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

  // 관리자 공지: (A) 관리자 작성 + is_notice=true, (B) 관리자 작성 + '공지' 태그
  let posts: {
    id: string;
    title: string;
    created_at: string;
    author_id: string;
  }[] = [];
  const adminIds = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminIds.length) {
    // A) is_notice=true 인 관리자 글
    const { data: byFlag } = await supabase
      .from("posts")
      .select("id,title,created_at,author_id")
      .eq("is_notice", true)
      .in("author_id", adminIds)
      .order("created_at", { ascending: false });

    // B) '공지' 태그가 달린 관리자 글
    const { data: tags } = await supabase
      .from("tags")
      .select("id")
      .ilike("name", "%공지%")
      .limit(5);
    const tagIds = (tags ?? []).map((t) => (t as { id: string }).id);
    let byTag: typeof posts = [];
    if (tagIds.length) {
      const { data: mappings } = await supabase
        .from("post_tags")
        .select("post_id,tag_id")
        .in("tag_id", tagIds);
      const postIds = Array.from(
        new Set((mappings ?? []).map((m) => (m as { post_id: string }).post_id))
      );
      if (postIds.length) {
        const { data } = await supabase
          .from("posts")
          .select("id,title,created_at,author_id")
          .in("id", postIds)
          .in("author_id", adminIds)
          .order("created_at", { ascending: false });
        byTag = (data ?? []) as typeof posts;
      }
    }

    // 합치고 중복 제거 후 최신순 정렬
    const map = new Map<
      string,
      { id: string; title: string; created_at: string; author_id: string }
    >();
    (byFlag ?? []).forEach((p) => map.set((p as { id: string }).id, p as any));
    (byTag ?? []).forEach((p) => map.set((p as { id: string }).id, p as unknown));
    posts = Array.from(map.values()).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    );
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
      <Section
        title={<span className="text-sm sm:text-base">공지사항</span>}
        className="mt-5"
        actions={
          canWrite ? (
            <Link href="/posts/new?tag=공지">
              <Button size="sm">글쓰기</Button>
            </Link>
          ) : null
        }
      >
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
                    className="hover:underline font-medium truncate text-sm sm:text-base"
                  >
                    {p.title}
                  </Link>
                  <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground inline-flex items-center gap-1">
                  <AdminIcon className="h-3.5 w-3.5" /> 관리자
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

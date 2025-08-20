import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Section } from "@/components/section";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";

// 타입 정의
type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type Post = {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
};

export default async function MyProfilePage() {
  const supabase = createSupabaseServerClient();

  // 로그인 상태 확인
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) {
    redirect("/login?next=/profile/me");
  }

  // 본인 프로필 정보 가져오기
  const { data: user } = await supabase
    .from("profiles")
    .select("id,username,avatar_url,bio")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!user) {
    redirect("/profile/setup");
  }

  // 본인 활동 데이터 가져오기
  const { data: initialPosts } = await supabase
    .from("posts")
    .select("id,title,content,created_at")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: initialComments } = await supabase
    .from("comments")
    .select("id,body,post_id,created_at")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // 저장된 게시물 데이터 가져오기 (본인만)
  let initialSaved: Post[] = [];
  const { data: savedData } = await supabase
    .from("collection_items")
    .select("posts(id,title,content,created_at), collections!inner(owner_id)")
    .eq("collections.owner_id", user.id)
    .limit(10);

  // 타입 안전한 데이터 변환
  if (savedData && Array.isArray(savedData)) {
    initialSaved = savedData
      .map((row: unknown) => {
        if (row && typeof row === "object" && row !== null && "posts" in row) {
          const postsData = (row as { posts: unknown }).posts;
          if (
            postsData &&
            typeof postsData === "object" &&
            postsData !== null
          ) {
            const post = postsData as {
              id: unknown;
              title: unknown;
              content: unknown;
              created_at: unknown;
            };
            if (
              typeof post.id === "string" &&
              typeof post.title === "string" &&
              typeof post.created_at === "string"
            ) {
              return {
                id: post.id,
                title: post.title,
                content: post.content as string | null,
                created_at: post.created_at,
              };
            }
          }
        }
        return null;
      })
      .filter((post): post is Post => post !== null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <Section>
        <ProfileHeader
          userId={user.id}
          initialUsername={user.username}
          initialBio={user.bio}
          avatarUrl={user.avatar_url}
        />
      </Section>

      <div className="border rounded-md p-4">
        <h2 className="text-base font-semibold mb-3">활동</h2>
        <ProfileTabs
          userId={user.id}
          isOwner={true}
          initialPosts={initialPosts ?? []}
          initialComments={initialComments ?? []}
          initialSaved={initialSaved}
        />
      </div>
    </div>
  );
}

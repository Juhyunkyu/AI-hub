import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/section";
import { ProfileMeta } from "@/components/profile/profile-meta";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { FollowButton } from "@/components/profile/follow-button";
import { UserAvatar } from "@/components/user-avatar";

// 타입 정의
type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
};

type Post = {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  post_type: string | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  // URL 디코딩 (한글 닉네임 지원)
  const decodedUsername = decodeURIComponent(username);

  // 로그인 상태 확인 (선택적)
  const { data: session } = await supabase.auth.getUser();

  // username으로 사용자 찾기 (UUID 접근은 차단)
  const { data: user } = await supabase
    .from("profiles")
    .select("id,username,avatar_url,bio,role")
    .eq("username", decodedUsername)
    .maybeSingle();

  if (!user) return notFound();

  const isOwner = session?.user?.id === user.id;

  // 본인인 경우 설정 페이지로 리다이렉트
  if (isOwner) {
    redirect("/profile/me");
  }

  // 공개 게시물만 가져오기 (익명 게시판 제외)
  const { data: publicPosts } = await supabase
    .from("posts")
    .select("id,title,content,created_at,post_type")
    .eq("author_id", user.id)
    .eq("status", "published")
    .neq("post_type", "anonymous") // 익명 게시판 제외
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: publicComments } = await supabase
    .from("comments")
    .select("id,body,post_id,created_at")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <Section>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar
              userId={user.id}
              username={user.username}
              avatarUrl={user.avatar_url}
              size="lg"
              showActions={!!session?.user}
              isOwner={false}
            />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">
                {user.username ?? "사용자"}
              </h1>
              <ProfileMeta userId={user.id} badges={[]} />
              {user.bio ? (
                <p className="text-sm text-muted-foreground line-clamp-2 max-w-prose">
                  {user.bio}
                </p>
              ) : null}
            </div>
          </div>
          {session?.user && <FollowButton targetUserId={user.id} />}
        </div>
      </Section>

      <div className="space-y-4">
        <div className="border rounded-md p-4">
          <h2 className="text-base font-semibold mb-3">활동</h2>
          <ProfileTabs
            userId={user.id}
            isOwner={false}
            initialPosts={publicPosts ?? []}
            initialComments={publicComments ?? []}
            initialSaved={[]} // 다른 사용자의 저장된 게시글은 표시하지 않음
          />
        </div>
      </div>
    </div>
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LikeButton } from "@/components/like-button";
// import { CommentForm } from "@/components/comment-form";
import { SaveButton } from "@/components/save-button";
import { ReportButton } from "@/components/report-button";
// import { CommentItem } from "@/components/comment-item";
import { Section } from "@/components/section";
import { UserAvatar } from "@/components/user-avatar";
import DOMPurify from "isomorphic-dompurify";
import { PostContent } from "@/components/post-content";
import { CommentSection } from "@/components/comment-section";
import { formatDate } from "@/lib/utils/date-format";
import Link from "next/link";
import { Home, ChevronRight, Hash } from "lucide-react";
import { PostOwnerActions } from "@/components/post-owner-actions";
import { Badge } from "@/components/ui/badge";

type PostRow = {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  author_id: string;
};

type ProfileLite = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  images?: string[];
};

export default async function PostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();

  const { data: postRaw } = await supabase
    .from("posts")
    .select("id,title,content,created_at,author_id")
    .eq("id", id)
    .maybeSingle();

  const post = postRaw as unknown as PostRow | null;
  if (!post) return notFound();

  // 게시글의 카테고리 정보 가져오기
  const { data: postTopics } = await supabase
    .from("post_topics")
    .select("topic_id")
    .eq("post_id", post.id)
    .limit(1);

  let categoryName = "자유게시판"; // 기본값
  let categorySlug = "free"; // 기본값

  if (postTopics && postTopics.length > 0) {
    const { data: topic } = await supabase
      .from("topics")
      .select("category_id")
      .eq("id", postTopics[0].topic_id)
      .single();

    if (topic) {
      const { data: category } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("id", topic.category_id)
        .single();

      if (category) {
        categoryName = category.name;
        categorySlug = category.slug;
      }
    }
  }

  const { data: authorRaw } = await supabase
    .from("profiles")
    .select("id,username,avatar_url")
    .eq("id", post.author_id)
    .maybeSingle();

  const author = authorRaw as unknown as ProfileLite | null;
  // 현재 사용자 확인 (서버 컴포넌트에서 쿠키 기반)
  const { data: me } = await supabase.auth.getUser();
  const currentUserId = me.user?.id ?? null;
  const isOwner = currentUserId === post.author_id;

  const { data: commentsRaw } = await supabase
    .from("comments")
    .select("id,body,created_at,author_id,parent_id,images")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  const comments = (commentsRaw ?? []) as unknown as CommentRow[];

  const commentAuthorIds = Array.from(
    new Set(comments.map((c) => c.author_id))
  );
  let commentAuthors: ProfileLite[] = [];
  if (commentAuthorIds.length) {
    const { data: raw } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .in("id", commentAuthorIds);
    commentAuthors = (raw ?? []) as unknown as ProfileLite[];
  }
  // const commentAuthorById = new Map<string, ProfileLite>(
  //   commentAuthors.map((u) => [u.id, u])
  // );

  // 태그 조회
  const { data: postTagsRaw } = await supabase
    .from("post_tags")
    .select("tags(id,name)")
    .eq("post_id", id);
  const tags = (postTagsRaw ?? [])
    .map((r) => (r as { tags?: { id?: string; name?: string } }).tags)
    .filter((t): t is { id: string; name: string } => !!t?.id && !!t?.name);

  const safeHtml = DOMPurify.sanitize(post.content ?? "", {
    // 카카오 지도 컨테이너와 미디어 요소, 캡션을 위한 태그 보강
    ADD_TAGS: ["video", "source", "figure", "figcaption", "div"],
    // 지도 data-*와 링크, 클래스/스타일 등 허용 속성 보강
    ADD_ATTR: [
      "controls",
      "src",
      "type",
      "class",
      "style",
      "alt",
      "href",
      "target",
      "rel",
      "data-provider",
      "data-lat",
      "data-lng",
      "data-name",
      "data-zoom",
    ],
  });

  return (
    <div className="space-y-10 sm:space-y-12">
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
            <Link
              href={`/categories/${categorySlug}`}
              className="text-foreground font-medium hover:text-primary transition-colors"
            >
              {categoryName}
            </Link>
          </nav>
        </div>
      </div>

      <Section>
        <article className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-bold">{post.title}</h1>
          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <UserAvatar
                userId={author?.id || ""}
                username={author?.username || null}
                avatarUrl={author?.avatar_url || null}
                size="sm"
                showActions={true}
                isOwner={false}
                showName={true}
              />
              <span>· {formatDate(post.created_at)}</span>
            </div>
            {isOwner && <PostOwnerActions postId={post.id} />}
          </div>
          <PostContent html={safeHtml} />
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> 태그
              </span>
              {tags.map((t) => (
                <Link key={t.id} href={`/?q=${encodeURIComponent(t.name)}`}>
                  <Badge variant="outline" className="text-xs">
                    {t.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            <LikeButton targetId={post.id} />
            <SaveButton postId={post.id} />
            <ReportButton targetId={post.id} targetType="post" />
          </div>
        </article>
      </Section>

      <CommentSection
        comments={comments}
        commentAuthors={commentAuthors}
        postId={post.id}
        postAuthorId={post.author_id}
      />
    </div>
  );
}

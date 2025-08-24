import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title: string = body?.title ?? "";
    const content: string = body?.content ?? "";
    const categoryId: string | undefined = body?.categoryId;
    const topicIds: string[] = Array.isArray(body?.topicIds) ? body.topicIds : [];
    const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];

    if (!title.trim()) return NextResponse.json({ error: "제목은 필수입니다" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "카테고리를 선택해주세요" }, { status: 400 });

    // 1) create post
    const { data: post, error: e1 } = await supabase
      .from("posts")
      .insert({ title, content, author_id: user.id })
      .select("id")
      .single();
    if (e1 || !post) return NextResponse.json({ error: e1?.message ?? "생성 실패" }, { status: 500 });

    const postId = (post as { id: string }).id;

    // 2) decide topics: use provided topics or default topic of the category
    let finalTopicIds: string[] = topicIds;
    if (!finalTopicIds.length) {
      const { data: defTopic } = await supabase
        .from("topics")
        .select("id")
        .eq("category_id", categoryId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (defTopic?.id) {
        finalTopicIds = [defTopic.id as string];
      } else {
        // 해당 카테고리에 주제가 없다면 기본 주제를 생성(관리자 키 사용)
        try {
          const admin = createSupabaseAdminClient();
          const defaultSlug = `default-${categoryId}`;
          const { data: createdTopic, error: cErr } = await admin
            .from("topics")
            .upsert(
              { slug: defaultSlug, name: "기본", description: null, category_id: categoryId },
              { onConflict: "slug" }
            )
            .select("id")
            .maybeSingle();
          if (cErr) {
            const { data: existing } = await admin
              .from("topics")
              .select("id")
              .eq("slug", defaultSlug)
              .maybeSingle();
            if (existing?.id) finalTopicIds = [existing.id as string];
          } else if (createdTopic?.id) {
            finalTopicIds = [createdTopic.id as string];
          }
        } catch (_) {
          // 서비스 키가 없거나 실패한 경우, 주제 매핑 없이도 진행
        }
      }
    }

    if (finalTopicIds.length) {
      const rows = finalTopicIds.map((topic_id) => ({ post_id: postId, topic_id }));
      const { error: e2 } = await supabase.from("post_topics").insert(rows);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    // 3) upsert tags by slug/name then link
    if (tags.length) {
      const admin = createSupabaseAdminClient();
      const slugify = (raw: string): string => {
        const s = (raw || "").trim().toLowerCase();
        // 한글 등 유니코드는 그대로 두고 공백->하이픈, 제어문자 제거
        const collapsed = s.replace(/\s+/g, "-");
        // 앞뒤 하이픈 정리
        return collapsed.replace(/^-+|-+$/g, "");
      };
      const upserts = tags.map((name) => ({ slug: slugify(name), name }));
      const { data: tagRows, error: e3 } = await admin
        .from("tags")
        .upsert(upserts, { onConflict: "slug" })
        .select("id,name,slug");
      if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
      const tagIds = (tagRows ?? [])
        .filter((r) => typeof r?.id === "string")
        .map((r) => (r as { id: string }).id);
      if (tagIds.length) {
        const mapRows = tagIds.map((tag_id) => ({ post_id: postId, tag_id }));
        const { error: e4 } = await supabase.from("post_tags").insert(mapRows);
        if (e4) return NextResponse.json({ error: e4.message }, { status: 500 });
      }
    }

    return NextResponse.json({ id: postId });
  } catch (error) {
    console.error("create post error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



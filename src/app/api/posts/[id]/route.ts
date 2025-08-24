import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { id } = await params;

    const { data: post, error } = await supabase
      .from("posts")
      .select("id,title,content,author_id,created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // 주제 및 카테고리 조회 (첫 번째 주제의 카테고리를 대표값으로 사용)
    const { data: ptRows } = await supabase
      .from("post_topics")
      .select("topic_id, topics(category_id)")
      .eq("post_id", id);

    const topicIds: string[] = (ptRows ?? [])
      .map((r: any) => r?.topic_id)
      .filter((v: unknown): v is string => typeof v === "string");

    let categoryId: string | null = null;
    const firstTopic = (ptRows ?? [])[0] as any;
    if (firstTopic?.topics?.category_id) {
      categoryId = firstTopic.topics.category_id as string;
    }

    // 태그 조회
    const { data: tagRows } = await supabase
      .from("post_tags")
      .select("tags(id,name)")
      .eq("post_id", id);

    const tags: string[] = (tagRows ?? [])
      .map((r: any) => r?.tags?.name)
      .filter((v: unknown): v is string => typeof v === "string");

    // 본문 조회는 공개글이면 모두 가능하고, 비공개 요건이 있으면 여기서 제한하면 됨
    // 편집 화면에서 소유자 확인용으로도 사용됨
    const isOwner = !!user && user.id === post.author_id;
    return NextResponse.json({ post, isOwner, categoryId, topicIds, tags });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title: string | undefined = body?.title;
    const content: string | undefined = body?.content;
    const tags: string[] | undefined = Array.isArray(body?.tags)
      ? (body.tags as string[])
      : undefined;

    if (!title && !content) {
      return NextResponse.json({ error: "no_fields" }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};
    if (typeof title === "string") updateFields.title = title;
    if (typeof content === "string") updateFields.content = content;

    const { id } = await params;

    const { data: updated, error } = await supabase
      .from("posts")
      .update(updateFields)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // 태그가 포함된 경우: 기존 매핑을 교체
    if (tags) {
      // 1) 태그 upsert (slug 기반)
      if (tags.length) {
        const slugify = (raw: string): string => {
          const s = (raw || "").trim().toLowerCase();
          const collapsed = s.replace(/\s+/g, "-");
          return collapsed.replace(/^-+|-+$/g, "");
        };
        const upserts = tags.map((name) => ({ slug: slugify(name), name }));
        const admin = createSupabaseAdminClient();
        const { data: tagRows, error: e3 } = await admin
          .from("tags")
          .upsert(upserts, { onConflict: "slug" })
          .select("id,name,slug");
        if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
        const tagIds = (tagRows ?? [])
          .filter((r: any) => typeof r?.id === "string")
          .map((r: any) => r.id as string);

        // 2) 기존 매핑 삭제 후 재삽입
        const { error: delErr } = await supabase
          .from("post_tags")
          .delete()
          .eq("post_id", id);
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

        if (tagIds.length) {
          const mapRows = tagIds.map((tag_id) => ({ post_id: id, tag_id }));
          const { error: mapErr } = await supabase.from("post_tags").insert(mapRows);
          if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 });
        }
      } else {
        // 빈 배열인 경우: 모든 태그 제거
        const { error: delErr } = await supabase
          .from("post_tags")
          .delete()
          .eq("post_id", id);
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



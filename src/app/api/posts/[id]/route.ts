import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { id } = await params;

    const { data: post, error } = await supabase
      .from("posts")
      .select("id,title,content,author_id,created_at,is_notice,anonymous,post_type,allow_comments,show_in_recent")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // 주제 및 카테고리 조회 (첫 번째 주제의 카테고리를 대표값으로 사용)
    const { data: ptRows } = await supabase
      .from("post_topics")
      .select("topic_id, topics(category_id)")
      .eq("post_id", id);

    type PostTopicRow = {
      topic_id?: string | null;
      topics?: { category_id?: string | null } | null;
    };
    const pt = (ptRows ?? []) as PostTopicRow[];
    const topicIds: string[] = pt
      .map((r) => r.topic_id)
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    let categoryId: string | null = null;
    if (pt.length > 0) {
      const cid = pt[0]?.topics?.category_id;
      if (typeof cid === "string" && cid) categoryId = cid;
    }

    // 태그 조회
    const { data: tagRows } = await supabase
      .from("post_tags")
      .select("tags(id,name)")
      .eq("post_id", id);

    type TagJoinRow = { tags?: { id?: string; name?: string } | null };
    const tagJoin = (tagRows ?? []) as TagJoinRow[];
    const tags: string[] = tagJoin
      .map((r) => r.tags?.name)
      .filter((v): v is string => typeof v === "string" && v.length > 0);

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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title: string | undefined = body?.title;
    const content: string | undefined = body?.content;
    const isNotice: boolean | undefined =
      typeof body?.isNotice === "boolean" ? body.isNotice : undefined;
    const isAnonymous: boolean | undefined =
      typeof body?.isAnonymous === "boolean" ? body.isAnonymous : undefined;
    const allowComments: boolean | undefined =
      typeof body?.allowComments === "boolean" ? body.allowComments : undefined;
    const showInRecent: boolean | undefined =
      typeof body?.showInRecent === "boolean" ? body.showInRecent : undefined;
    // pin fields (admin only)
    const pinned: boolean | undefined =
      typeof body?.pinned === "boolean" ? body.pinned : undefined;
    const pinScope: "global" | "category" | undefined = body?.pinScope;
    const pinnedUntilRaw: string | undefined = body?.pinnedUntil;
    const pinPriority: number | undefined =
      typeof body?.pinPriority === "number" ? body.pinPriority : undefined;
    const pinnedCategoryId: string | undefined = body?.pinnedCategoryId;
    const tags: string[] | undefined = Array.isArray(body?.tags)
      ? (body.tags as string[])
      : undefined;

    // 익명과 공지 동시 선택 불가
    if (isAnonymous === true && isNotice === true) {
      return NextResponse.json({ error: "익명과 공지사항은 동시에 선택할 수 없습니다" }, { status: 400 });
    }

    if (!title && !content && typeof isNotice === "undefined" && typeof isAnonymous === "undefined" && typeof allowComments === "undefined" && typeof showInRecent === "undefined" && typeof pinned === "undefined" && typeof pinScope === "undefined" && typeof pinnedUntilRaw === "undefined" && typeof pinPriority === "undefined" && typeof pinnedCategoryId === "undefined" && !tags) {
      return NextResponse.json({ error: "no_fields" }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};
    if (typeof title === "string") updateFields.title = title;
    if (typeof content === "string") updateFields.content = content;
    if (typeof isNotice === "boolean") {
      updateFields.is_notice = isNotice;
      // 공지사항이 되면 익명이 아님
      if (isNotice) {
        updateFields.anonymous = false;
        updateFields.post_type = 'notice';
      }
    }
    if (typeof isAnonymous === "boolean") {
      updateFields.anonymous = isAnonymous;
      // 익명이 되면 공지사항이 아님
      if (isAnonymous) {
        updateFields.is_notice = false;
        updateFields.post_type = 'anonymous';
      } else {
        updateFields.post_type = 'general';
      }
    }
    if (typeof allowComments === "boolean") updateFields.allow_comments = allowComments;
    if (typeof showInRecent === "boolean") updateFields.show_in_recent = showInRecent;
    // pin updates only by admin
    const supa = await createSupabaseServerClient();
    const {
      data: { user: me },
    } = await supa.auth.getUser();
    const allowed = (process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const isAdminUser = !!me?.id && allowed.includes(me.id);
    if (isAdminUser) {
      if (typeof pinned === "boolean") {
        if (!pinned) {
          updateFields.pin_scope = null;
          updateFields.pinned_until = null;
          updateFields.pin_priority = 0;
          updateFields.pinned_category_id = null;
        } else {
          updateFields.pin_scope = pinScope === "category" ? "category" : "global";
          updateFields.pinned_until = pinnedUntilRaw
            ? new Date(pinnedUntilRaw).toISOString()
            : null;
          if (typeof pinPriority === "number") updateFields.pin_priority = pinPriority;
          updateFields.pinned_category_id =
            pinScope === "category" ? pinnedCategoryId || null : null;
        }
      } else if (
        typeof pinScope !== "undefined" ||
        typeof pinnedUntilRaw !== "undefined" ||
        typeof pinPriority !== "undefined" ||
        typeof pinnedCategoryId !== "undefined"
      ) {
        if (typeof pinScope !== "undefined")
          updateFields.pin_scope = pinScope === "category" ? "category" : "global";
        if (typeof pinnedUntilRaw !== "undefined")
          updateFields.pinned_until = pinnedUntilRaw
            ? new Date(pinnedUntilRaw).toISOString()
            : null;
        if (typeof pinPriority === "number") updateFields.pin_priority = pinPriority;
        if (typeof pinnedCategoryId !== "undefined")
          updateFields.pinned_category_id = pinnedCategoryId || null;
      }
    }

    const { id } = await params;

    const { data: updated, error } = await supabase
      .from("posts")
      .update(updateFields)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // 익명 게시글로 변경되는 경우 모든 태그 제거
    if (isAnonymous === true) {
      const { error: delErr } = await supabase
        .from("post_tags")
        .delete()
        .eq("post_id", id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    // 태그가 포함된 경우: 기존 매핑을 교체 (익명이 아닐 때만)
    else if (tags) {
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
        const tagRowsTyped = (tagRows ?? []) as { id?: string | null }[];
        const tagIds = tagRowsTyped
          .map((r) => r.id)
          .filter((id): id is string => typeof id === "string");

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
    const supabase = await createSupabaseServerClient();
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



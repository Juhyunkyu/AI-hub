import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      post_id,
      author_id,
      body: commentBody,
      parent_id,
      images,
      anonymous = false,
    } = body;

    if (!post_id || !commentBody?.trim()) {
      return NextResponse.json(
        { error: "post_id and body are required" },
        { status: 400 }
      );
    }

    if (author_id !== user.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 익명 댓글인 경우 번호 할당
    let anonymousNumber: number | null = null;
    if (anonymous) {
      // 해당 게시글에서 해당 사용자의 익명 댓글이 이미 있는지 확인
      const { data: existingComment } = await supabase
        .from("comments")
        .select("anonymous_number")
        .eq("post_id", post_id)
        .eq("author_id", author_id)
        .eq("anonymous", true)
        .not("anonymous_number", "is", null)
        .limit(1)
        .maybeSingle();

      if (existingComment?.anonymous_number) {
        // 기존 번호 재사용
        anonymousNumber = existingComment.anonymous_number;
      } else {
        // 새 번호 할당 - 해당 게시글의 최대 익명 번호 + 1
        const { data: maxNumberResult } = await supabase
          .from("comments")
          .select("anonymous_number")
          .eq("post_id", post_id)
          .eq("anonymous", true)
          .not("anonymous_number", "is", null)
          .order("anonymous_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const maxNumber = maxNumberResult?.anonymous_number || 0;
        anonymousNumber = maxNumber + 1;
      }
    }

    const commentData: Record<string, unknown> = {
      post_id,
      author_id,
      body: commentBody,
      anonymous,
      anonymous_number: anonymousNumber,
    };

    if (parent_id) {
      commentData.parent_id = parent_id;
    }

    if (images && Array.isArray(images) && images.length > 0) {
      commentData.images = images;
    }

    const { data: comment, error } = await supabase
      .from("comments")
      .insert(commentData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? ((error as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
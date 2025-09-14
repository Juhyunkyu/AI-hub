import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "comment ID is required" },
        { status: 400 }
      );
    }

    // 댓글 존재 여부 및 소유자 확인
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("id, author_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (comment.author_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 이미 삭제된 댓글인지 확인
    if (comment.status === 'deleted') {
      return NextResponse.json(
        { error: "Comment is already deleted" },
        { status: 400 }
      );
    }

    // Soft delete: status를 'deleted'로 변경하고 내용을 대체
    const { error: updateError } = await supabase
      .from("comments")
      .update({
        status: 'deleted',
        body: '작성자가 삭제한 댓글입니다',
        images: null,  // 이미지도 제거
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "댓글이 삭제되었습니다"
    });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? ((error as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { body: commentBody } = body;

    if (!id) {
      return NextResponse.json(
        { error: "comment ID is required" },
        { status: 400 }
      );
    }

    if (!commentBody?.trim()) {
      return NextResponse.json(
        { error: "comment body is required" },
        { status: 400 }
      );
    }

    // 댓글 존재 여부 및 소유자 확인
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("id, author_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (comment.author_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 삭제된 댓글은 수정 불가
    if (comment.status === 'deleted') {
      return NextResponse.json(
        { error: "Cannot edit deleted comment" },
        { status: 400 }
      );
    }

    // 댓글 수정
    const { error: updateError } = await supabase
      .from("comments")
      .update({
        body: commentBody.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "댓글이 수정되었습니다"
    });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? ((error as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
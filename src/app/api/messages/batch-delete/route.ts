import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 받은/보낸 쪽지 일괄 삭제(소프트 삭제)
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    if (!ids.length) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    // 받은/보낸 쪽지 각각에 대해 소프트 삭제 컬럼 설정
    const { error } = await supabase
      .from("messages")
      .update({
        deleted_by_receiver: true,
      })
      .in("id", ids)
      .eq("to_user_id", user.id);

    if (error) {
      console.error("Batch delete(received) error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    const { error: error2 } = await supabase
      .from("messages")
      .update({
        deleted_by_sender: true,
      })
      .in("id", ids)
      .eq("from_user_id", user.id);

    if (error2) {
      console.error("Batch delete(sent) error:", error2);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 선택한 받은 쪽지 읽음/읽지않음 처리
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
    const read = typeof body?.read === "boolean" ? (body.read as boolean) : true;
    if (!ids.length) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const { error } = await supabase
      .from("messages")
      .update({ read })
      .in("id", ids)
      .eq("to_user_id", user.id)
      .eq("deleted_by_receiver", false);

    if (error) {
      console.error("Batch mark read error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




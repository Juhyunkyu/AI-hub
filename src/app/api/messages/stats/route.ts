import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 받은 쪽지 수 (삭제되지 않은 것만)
    const { count: receivedCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("to_user_id", user.id)
      .eq("deleted_by_receiver", false);

    // 보낸 쪽지 수 (삭제되지 않은 것만)
    const { count: sentCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("from_user_id", user.id)
      .eq("deleted_by_sender", false);

    // 읽지 않은 쪽지 수
    const { count: unreadCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("to_user_id", user.id)
      .eq("read", false)
      .eq("deleted_by_receiver", false);

    return NextResponse.json({
      stats: {
        unread_count: unreadCount || 0,
        total_received: receivedCount || 0,
        total_sent: sentCount || 0,
      }
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = params;

    // 사용자가 해당 채팅방의 참여자인지 확인
    const { data: participant, error: participantError } = await supabase
      .from("chat_room_participants")
      .select("id, is_admin")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "참여하지 않은 채팅방입니다" },
        { status: 403 }
      );
    }

    // 채팅방에서 사용자를 제거
    const { error: leaveError } = await supabase
      .from("chat_room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    if (leaveError) {
      console.error("Error leaving room:", leaveError);
      return NextResponse.json(
        { error: "채팅방 나가기에 실패했습니다" },
        { status: 500 }
      );
    }

    // 채팅방에 남은 참여자 수 확인
    const { count: remainingParticipants } = await supabase
      .from("chat_room_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    // 남은 참여자가 없으면 채팅방 삭제
    if (remainingParticipants === 0) {
      // 메시지들도 함께 삭제
      await supabase
        .from("chat_messages")
        .delete()
        .eq("room_id", roomId);

      // 채팅방 삭제
      await supabase
        .from("chat_rooms")
        .delete()
        .eq("id", roomId);
    }

    // Service Worker 캐시 무효화
    return NextResponse.json({ 
      success: true,
      message: "채팅방에서 나갔습니다",
      _invalidateCache: "rooms"
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
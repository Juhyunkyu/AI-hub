import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 고아 채팅방 정리 API (개발용)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 개발 환경에서만 실행 (안전장치)
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
    }

    console.log("🧹 고아 채팅방 정리 시작...");

    // 1. 참여자가 없는 채팅방 찾기
    const { data: orphanRooms } = await supabase
      .from("chat_rooms")
      .select(`
        id,
        name,
        type,
        created_at,
        participants:chat_room_participants(user_id)
      `);

    const roomsToDelete = orphanRooms?.filter(room =>
      !room.participants || room.participants.length === 0
    ) || [];

    console.log(`발견된 고아 채팅방: ${roomsToDelete.length}개`);

    if (roomsToDelete.length === 0) {
      return NextResponse.json({
        message: "정리할 고아 채팅방이 없습니다",
        deleted_rooms: []
      });
    }

    // 2. 각 고아 채팅방의 메시지도 함께 삭제
    const deletedRooms = [];
    for (const room of roomsToDelete) {
      console.log(`삭제 중: ${room.id} (${room.type})`);

      // 관련 메시지 삭제
      const { error: messagesError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("room_id", room.id);

      if (messagesError) {
        console.error(`메시지 삭제 실패 (${room.id}):`, messagesError);
      }

      // 채팅방 삭제
      const { error: roomError } = await supabase
        .from("chat_rooms")
        .delete()
        .eq("id", room.id);

      if (roomError) {
        console.error(`채팅방 삭제 실패 (${room.id}):`, roomError);
      } else {
        deletedRooms.push(room);
      }
    }

    console.log(`✅ 정리 완료: ${deletedRooms.length}개 채팅방 삭제`);

    return NextResponse.json({
      message: `${deletedRooms.length}개의 고아 채팅방을 정리했습니다`,
      deleted_rooms: deletedRooms.map(r => ({
        id: r.id,
        type: r.type,
        created_at: r.created_at
      }))
    });

  } catch (error) {
    console.error("고아 채팅방 정리 중 오류:", error);
    return NextResponse.json(
      { error: "정리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = params;
    const { user_ids }: { user_ids: string[] } = await request.json();

    if (!user_ids || user_ids.length === 0) {
      return NextResponse.json(
        { error: "At least one user ID is required" },
        { status: 400 }
      );
    }

    // 채팅방이 존재하고 현재 사용자가 참여자인지 확인
    const { data: roomParticipant, error: roomError } = await supabase
      .from("chat_room_participants")
      .select("room_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (roomError || !roomParticipant) {
      return NextResponse.json(
        { error: "Room not found or access denied" },
        { status: 404 }
      );
    }

    // 초대할 사용자들이 존재하는지 확인
    const { data: usersToInvite, error: usersError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", user_ids);

    if (usersError || !usersToInvite || usersToInvite.length !== user_ids.length) {
      return NextResponse.json(
        { error: "Some user IDs are invalid" },
        { status: 400 }
      );
    }

    // 이미 참여 중인 사용자들 확인
    const { data: existingParticipants } = await supabase
      .from("chat_room_participants")
      .select("user_id")
      .eq("room_id", roomId)
      .in("user_id", user_ids);

    const existingUserIds = existingParticipants?.map(p => p.user_id) || [];
    const newUserIds = user_ids.filter(id => !existingUserIds.includes(id));

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: "All users are already participants" },
        { status: 400 }
      );
    }

    // 새 참여자들 추가
    const participantsData = newUserIds.map(userId => ({
      room_id: roomId,
      user_id: userId,
      is_admin: false,
    }));

    const { error: inviteError } = await supabase
      .from("chat_room_participants")
      .insert(participantsData);

    if (inviteError) {
      console.error("Error inviting users:", inviteError);
      return NextResponse.json(
        { error: "Failed to invite users" },
        { status: 500 }
      );
    }

    // 채팅방 타입을 group으로 변경 (1:1에서 그룹으로 전환)
    const { data: currentRoom } = await supabase
      .from("chat_rooms")
      .select("type")
      .eq("id", roomId)
      .single();

    if (currentRoom?.type === "direct") {
      await supabase
        .from("chat_rooms")
        .update({ type: "group" })
        .eq("id", roomId);
    }

    return NextResponse.json({
      success: true,
      invited_count: newUserIds.length,
      message: `${newUserIds.length}명을 초대했습니다`,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
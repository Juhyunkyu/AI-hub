import { NextRequest, NextResponse } from "next/server";
import { CreateChatRoomData } from "@/types/chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 타입 정의
interface ChatRoomParticipant {
  id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_admin: boolean;
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface ChatRoom {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
  updated_at: string;
  participants: ChatRoomParticipant[];
}

interface ExistingRoomParticipant {
  user_id: string;
}

interface ExistingRoom {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
  updated_at: string;
  participants: ExistingRoomParticipant[];
}

// 채팅방 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 먼저 사용자가 참여한 채팅방 ID들을 가져옴
    const { data: userRooms } = await supabase
      .from("chat_room_participants")
      .select("room_id")
      .eq("user_id", user.id);

    if (!userRooms || userRooms.length === 0) {
      return NextResponse.json({
        rooms: [],
        page,
        limit,
        hasMore: false,
      });
    }

    const roomIds = userRooms.map((room) => room.room_id);

    // 채팅방 정보와 모든 참여자 정보를 가져옴
    const { data: rooms, error } = await supabase
      .from("chat_rooms")
      .select(
        `
        *,
        participants:chat_room_participants(
          id,
          user_id,
          joined_at,
          last_read_at,
          is_admin,
          user:profiles(id, username, avatar_url)
        )
      `
      )
      .in("id", roomIds)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching chat rooms:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat rooms" },
        { status: 500 }
      );
    }

    // 각 채팅방의 마지막 메시지와 읽지 않은 메시지 수를 가져옴
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room) => {
        // 마지막 메시지 가져오기
        const { data: lastMessage } = await supabase
          .from("chat_messages")
          .select(
            `
            *,
            sender:profiles(id, username, avatar_url)
          `
          )
          .eq("room_id", room.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // 읽지 않은 메시지 수 계산
        const userParticipant = room.participants.find(
          (p: ChatRoomParticipant) => p.user_id === user.id
        );
        const lastReadAt = userParticipant?.last_read_at;

        let unreadCount = 0;
        if (lastReadAt) {
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id)
            .gt("created_at", lastReadAt)
            .neq("sender_id", user.id);

          unreadCount = count || 0;
        } else {
          // 처음 참여한 경우 모든 메시지가 읽지 않음
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id)
            .neq("sender_id", user.id);

          unreadCount = count || 0;
        }

        return {
          ...room,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      })
    );

    return NextResponse.json({
      rooms: roomsWithDetails,
      page,
      limit,
      hasMore: roomsWithDetails.length === limit,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 새 채팅방 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("Chat room creation - Auth check:", {
      user: user?.id,
      email: user?.email,
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, type, participant_ids }: CreateChatRoomData =
      await request.json();
    console.log("Chat room creation - Request data:", {
      name,
      type,
      participant_ids,
    });

    if (!type || !participant_ids || participant_ids.length === 0) {
      return NextResponse.json(
        { error: "Type and participant IDs are required" },
        { status: 400 }
      );
    }

    // 참여자 목록에 현재 사용자 추가 (중복 제거)
    const allParticipantIds = Array.from(
      new Set([user.id, ...participant_ids])
    );

    console.log("Chat room creation - All participants:", {
      allParticipantIds,
      currentUser: user.id,
    });

    // 1:1 채팅인 경우 기존 채팅방이 있는지 확인
    if (type === "direct" && participant_ids.length === 1) {
      const { data: existingRooms } = await supabase
        .from("chat_rooms")
        .select(
          `
          id,
          name,
          type,
          created_at,
          updated_at,
          participants:chat_room_participants(user_id)
        `
        )
        .eq("type", "direct");

      // 정확히 같은 참여자들로 구성된 1:1 채팅방이 있는지 확인
      const existingRoom = existingRooms?.find((room: ExistingRoom) => {
        const roomParticipants = room.participants.map(
          (p: ExistingRoomParticipant) => p.user_id
        );
        return (
          roomParticipants.length === 2 &&
          roomParticipants.includes(user.id) &&
          roomParticipants.includes(participant_ids[0])
        );
      });

      if (existingRoom) {
        return NextResponse.json({ room: existingRoom });
      }
    }

    // 채팅방 생성
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        name: name || null,
        type,
      })
      .select()
      .single();

    if (roomError) {
      console.error("Error creating chat room:", roomError);
      return NextResponse.json(
        {
          error: "Failed to create chat room",
          details: roomError.message,
          code: roomError.code,
        },
        { status: 500 }
      );
    }

    console.log("Chat room created:", room);

    // 참여자 추가
    const participantsData = allParticipantIds.map((participantId) => ({
      room_id: room.id,
      user_id: participantId,
      is_admin: participantId === user.id, // 생성자를 관리자로 설정
    }));

    const { error: participantInsertError } = await supabase
      .from("chat_room_participants")
      .insert(participantsData);

    if (participantInsertError) {
      console.error("Error adding participants:", participantInsertError);
      // 채팅방 생성은 성공했지만 참여자 추가 실패 시 채팅방 삭제
      await supabase.from("chat_rooms").delete().eq("id", room.id);
      return NextResponse.json(
        { error: "Failed to add participants" },
        { status: 500 }
      );
    }

    console.log("Participants added successfully");

    // 생성된 채팅방 정보를 다시 조회해서 반환
    const { data: createdRoom, error: fetchError } = await supabase
      .from("chat_rooms")
      .select(
        `
        *,
        participants:chat_room_participants(
          id,
          user_id,
          joined_at,
          last_read_at,
          is_admin,
          user:profiles(id, username, avatar_url)
        )
      `
      )
      .eq("id", room.id)
      .single();

    if (fetchError) {
      console.error("Error fetching created room:", fetchError);
      return NextResponse.json(
        { error: "Room created but failed to fetch details" },
        { status: 500 }
      );
    }

    console.log("Chat room creation completed:", createdRoom);

    return NextResponse.json({ room: createdRoom });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { CreateChatRoomData } from "@/types/chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CreateChatRoomSchema,
  PostgreSQLFunctionResponseSchema,
  validateDirectChatRoom,
  type CreateChatRoom,
  type PostgreSQLFunctionResponse
} from "@/lib/schemas";

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

// Removed unused interfaces - functionality moved to PostgreSQL functions

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
    const { data: userRooms, error: participantsError } = await supabase
      .from("chat_room_participants")
      .select("room_id")
      .eq("user_id", user.id);

    if (participantsError) {
      console.error("Error fetching user rooms:", participantsError);
      return NextResponse.json(
        { error: "Failed to fetch user rooms" },
        { status: 500 }
      );
    }

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

    // unread 카운트를 SSOT 뷰에서 일괄 조회하여 맵으로 구성
    const { data: unreadRows, error: unreadError } = await supabase
      .from("unread_message_counts")
      .select("room_id, unread_count")
      .eq("user_id", user.id)
      .in("room_id", roomIds);

    if (unreadError) {
      console.error("Error fetching unread counts from view:", unreadError);
    }

    const unreadMap = new Map<string, number>();
    (unreadRows || []).forEach((row: any) => {
      if (row && row.room_id) {
        unreadMap.set(row.room_id, row.unread_count || 0);
      }
    });

    // 각 채팅방의 마지막 메시지와 unread 카운트(뷰 기반)를 결합
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room) => {
        // 마지막 메시지 가져오기 (기존 로직 유지)
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

        const unreadCount = unreadMap.get(room.id) || 0;

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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await request.json();

    // 스키마 검증을 통한 입력 검증 및 보안 강화
    let validatedData: CreateChatRoom;
    try {
      validatedData = CreateChatRoomSchema.parse(requestBody);
    } catch (validationError) {
      console.error('Request validation failed:', validationError);
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationError instanceof Error ? validationError.message : "Validation failed"
        },
        { status: 400 }
      );
    }

    const { name, type, participant_ids } = validatedData;

    // 1:1 채팅방인 경우 PostgreSQL 함수 사용 (무한 재귀 방지)
    if (type === "direct" && participant_ids.length === 1) {
      const targetUserId = participant_ids[0];

      // 추가 검증 (스키마와 중복되지만 명시적 보안 강화)
      try {
        validateDirectChatRoom(user.id, targetUserId);
      } catch (validationError) {
        return NextResponse.json(
          {
            error: validationError instanceof Error
              ? validationError.message
              : "Invalid chat room creation request"
          },
          { status: 400 }
        );
      }

      const { data: result, error: functionError } = await supabase
        .rpc('create_or_get_direct_chat_room', {
          p_current_user_id: user.id,
          p_target_user_id: targetUserId
        });

      if (functionError) {
        console.error('Error calling create_or_get_direct_chat_room:', functionError);
        return NextResponse.json(
          { error: "Failed to create direct chat room" },
          { status: 500 }
        );
      }

      // PostgreSQL 함수 응답 검증
      // RPC 함수는 중첩된 객체를 반환하므로 함수명 키로 접근
      const actualResult = result?.create_or_get_direct_chat_room || result;
      let validatedResult: PostgreSQLFunctionResponse;
      try {
        validatedResult = PostgreSQLFunctionResponseSchema.parse(actualResult);
      } catch (schemaError) {
        console.error('PostgreSQL function response validation failed:', schemaError);
        console.error('Received result:', result);
        return NextResponse.json(
          { error: "Invalid server response format" },
          { status: 500 }
        );
      }

      if (!validatedResult.success) {
        return NextResponse.json(
          { error: validatedResult.error || "Failed to create chat room" },
          { status: 500 }
        );
      }

      // 생성된 채팅방 정보 조회
      const { data: createdRoom, error: fetchError } = await supabase
        .from("chat_rooms")
        .select(`
          *,
          participants:chat_room_participants(
            id,
            user_id,
            joined_at,
            last_read_at,
            is_admin,
            user:profiles(id, username, avatar_url)
          )
        `)
        .eq("id", validatedResult.room_id!)
        .single();

      if (fetchError) {
        console.error("Error fetching created room:", fetchError);
        return NextResponse.json(
          { error: "Room created but failed to fetch details" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        room: createdRoom,
        is_new: validatedResult.is_new
      });
    }

    // 그룹 채팅방 또는 기타 타입의 경우 배치 함수 사용
    const allParticipantIds = type === "self"
      ? [user.id]
      : Array.from(new Set([user.id, ...participant_ids]));

    // self 타입 채팅방 중복 체크
    if (type === "self") {
      const { data: existingSelfRoom } = await supabase
        .from("chat_rooms")
        .select(`
          id,
          name,
          type,
          created_at,
          updated_at,
          participants:chat_room_participants(
            id,
            user_id,
            joined_at,
            last_read_at,
            is_admin,
            user:profiles(id, username, avatar_url)
          )
        `)
        .eq("type", "self")
        .limit(1);

      // 기존 self 채팅방이 있는지 확인
      const existingRoom = existingSelfRoom?.find((room: any) => {
        const participants = room.participants || [];
        return participants.length === 1 && participants[0]?.user_id === user.id;
      });

      if (existingRoom) {
        return NextResponse.json({ room: existingRoom });
      }
    }

    // 배치 함수를 사용한 채팅방 생성
    const roomData = {
      type,
      name: name || null,
      creator_id: user.id,
      participant_ids: allParticipantIds
    };

    const { data: batchResult, error: batchError } = await supabase
      .rpc('create_chat_room_batch', { p_room_data: roomData });

    if (batchError || !batchResult?.success) {
      console.error('Error calling create_chat_room_batch:', batchError);
      return NextResponse.json(
        { error: batchResult?.error || "Failed to create chat room" },
        { status: 500 }
      );
    }

    // 생성된 채팅방 정보 조회
    const { data: createdRoom, error: fetchError } = await supabase
      .from("chat_rooms")
      .select(`
        *,
        participants:chat_room_participants(
          id,
          user_id,
          joined_at,
          last_read_at,
          is_admin,
          user:profiles(id, username, avatar_url)
        )
      `)
      .eq("id", batchResult.room_id)
      .single();

    if (fetchError) {
      console.error("Error fetching created room:", fetchError);
      return NextResponse.json(
        { error: "Room created but failed to fetch details" },
        { status: 500 }
      );
    }

    return NextResponse.json({ room: createdRoom });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

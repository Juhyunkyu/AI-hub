import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { SendMessageData } from "@/types/chat";

// 메시지 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const room_id = searchParams.get("room_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    if (!room_id) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    // 사용자가 해당 채팅방의 참여자인지 확인
    const { data: participant } = await supabase
      .from("chat_room_participants")
      .select("id")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }


    // 메시지 조회
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select(`
        *,
        sender:profiles(id, username, avatar_url),
        reply_to:chat_messages(
          *,
          sender:profiles(id, username, avatar_url)
        ),
        reads:chat_message_reads(user_id)
      `)
      .eq("room_id", room_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);


    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // 메시지를 시간순으로 정렬하고 읽은 사용자 목록 처리
    const processedMessages = messages
      ?.map((message: any) => ({
        ...message,
        read_by: message.reads?.map((read: any) => read.user_id) || []
      }))
      .reverse() || [];

    // 마지막 읽은 시간 업데이트
    if (processedMessages.length > 0) {
      await supabase
        .from("chat_room_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", room_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      messages: processedMessages,
      page,
      limit,
      hasMore: processedMessages.length === limit
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 새 메시지 전송
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { room_id, content, message_type = "text", file_url, file_name, file_size, reply_to_id }: SendMessageData = await request.json();

    if (!room_id || !content) {
      return NextResponse.json({ error: "Room ID and content are required" }, { status: 400 });
    }

    // 사용자가 해당 채팅방의 참여자인지 확인
    const { data: participant } = await supabase
      .from("chat_room_participants")
      .select("id")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 답장 메시지인 경우 원본 메시지가 존재하는지 확인
    if (reply_to_id) {
      const { data: replyMessage } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("id", reply_to_id)
        .eq("room_id", room_id)
        .single();

      if (!replyMessage) {
        return NextResponse.json({ error: "Reply message not found" }, { status: 404 });
      }
    }

    // 메시지 생성
    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id,
        sender_id: user.id,
        content,
        message_type,
        file_url,
        file_name,
        file_size,
        reply_to_id
      })
      .select(`
        *,
        sender:profiles(id, username, avatar_url),
        reply_to:chat_messages(
          *,
          sender:profiles(id, username, avatar_url)
        )
      `)
      .single();

    if (error) {
      console.error("Error creating message:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // 자동으로 읽음 처리
    await supabase
      .from("chat_message_reads")
      .insert({
        message_id: message.id,
        user_id: user.id
      });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}















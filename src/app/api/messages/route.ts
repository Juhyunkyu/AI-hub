import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 쪽지 목록 조회 (받은 쪽지)
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "received"; // received, sent
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (type === "received") {
      query = query.eq("to_user_id", user.id).eq("deleted_by_receiver", false);
    } else if (type === "sent") {
      query = query.eq("from_user_id", user.id).eq("deleted_by_sender", false);
    }

    const { data: messages, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // 사용자 정보 가져오기
    const userIds = new Set<string>();
    messages?.forEach(message => {
      userIds.add(message.from_user_id);
      userIds.add(message.to_user_id);
    });

    let users: any[] = [];
    if (userIds.size > 0) {
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", Array.from(userIds));

      if (userError) {
        console.error("Error fetching users:", userError);
        return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
      }
      users = userData || [];
    }

    // 메시지와 사용자 정보 결합
    const messagesWithUsers = messages?.map(message => {
      const fromUser = users.find(u => u.id === message.from_user_id);
      const toUser = users.find(u => u.id === message.to_user_id);
      
      return {
        ...message,
        from_user: fromUser || { id: message.from_user_id, username: "알 수 없음", avatar_url: null },
        to_user: toUser || { id: message.to_user_id, username: "알 수 없음", avatar_url: null }
      };
    }) || [];

    // 전체 개수를 별도로 가져오기
    let countQuery = supabase
      .from("messages")
      .select("*", { count: "exact", head: true });

    if (type === "received") {
      countQuery = countQuery.eq("to_user_id", user.id).eq("deleted_by_receiver", false);
    } else if (type === "sent") {
      countQuery = countQuery.eq("from_user_id", user.id).eq("deleted_by_sender", false);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      messages: messagesWithUsers,
      total: count || 0,
      page,
      limit,
      hasMore: (count || 0) > offset + limit
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 새 쪽지 보내기
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { to_user_id, subject, content } = await request.json();

    if (!to_user_id || !subject || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 받는 사람이 존재하는지 확인
    const { data: recipient } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", to_user_id)
      .single();

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // 자기 자신에게 쪽지를 보낼 수 없음
    if (to_user_id === user.id) {
      return NextResponse.json({ error: "Cannot send message to yourself" }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        from_user_id: user.id,
        to_user_id,
        subject,
        content
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating message:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

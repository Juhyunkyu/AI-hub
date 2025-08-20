import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 쪽지 상세 조회 및 읽음 표시
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 쪽지 조회 (받는 사람 또는 보낸 사람)
    const { data: message, error } = await supabase
      .from("messages")
      .select("*")
      .eq("id", params.id)
      .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
      .single();

    if (error || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // 삭제된 쪽지 체크
    if (message.to_user_id === user.id && message.deleted_by_receiver) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (message.from_user_id === user.id && message.deleted_by_sender) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // 사용자 정보 가져오기
    const { data: users, error: userError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", [message.from_user_id, message.to_user_id]);

    if (userError) {
      console.error("Error fetching users:", userError);
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    // 메시지와 사용자 정보 결합
    const fromUser = users?.find(u => u.id === message.from_user_id);
    const toUser = users?.find(u => u.id === message.to_user_id);

    const messageWithUsers = {
      ...message,
      from_user: fromUser || { id: message.from_user_id, username: "알 수 없음", avatar_url: null },
      to_user: toUser || { id: message.to_user_id, username: "알 수 없음", avatar_url: null }
    };

    // 읽음 표시 (받는 사람만)
    if (!message.read && message.to_user_id === user.id) {
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("id", params.id);
      
      messageWithUsers.read = true;
    }

    return NextResponse.json({ message: messageWithUsers });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 쪽지 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 쪽지 정보 조회
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // 권한 확인 (보낸 사람 또는 받는 사람만 삭제 가능)
    if (message.from_user_id !== user.id && message.to_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 소프트 삭제 업데이트
    const updateData: any = {};
    if (message.from_user_id === user.id) {
      updateData.deleted_by_sender = true;
    }
    if (message.to_user_id === user.id) {
      updateData.deleted_by_receiver = true;
    }

    const { error: updateError } = await supabase
      .from("messages")
      .update(updateData)
      .eq("id", params.id);

    if (updateError) {
      console.error("Error deleting message:", updateError);
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { SendMessageData, MessageWithSender } from "@/types/chat";

// 이미지 파일인지 판단하는 헬퍼 함수
const isImageFile = (file: File): boolean => {
  // MIME 타입으로 판단
  if (file.type.startsWith('image/')) {
    return true;
  }

  // 확장자로도 판단 (fallback)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const fileName = file.name.toLowerCase();
  return imageExtensions.some(ext => fileName.endsWith(ext));
};

// MIME 타입으로 이미지 파일인지 판단하는 함수
const isImageMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith('image/') ||
         ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].some(ext =>
           mimeType.includes(ext.substring(1))
         );
};

// 파일 타입 결정 함수
const getMessageType = (file?: File, fileName?: string, mimeType?: string): "text" | "file" | "image" | "location" => {
  if (!file && !fileName) return "text";

  // 위치 공유 파일 판단 (location-*.json)
  if (fileName && fileName.startsWith('location-') && fileName.endsWith('.json')) {
    return "location";
  }

  // File 객체가 있는 경우
  if (file) {
    // 파일명으로 위치 공유 확인
    if (file.name.startsWith('location-') && file.name.endsWith('.json')) {
      return "location";
    }
    return isImageFile(file) ? "image" : "file";
  }

  // MIME 타입이나 파일명으로 판단
  if (mimeType && isImageMimeType(mimeType)) {
    return "image";
  }

  if (fileName) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerFileName = fileName.toLowerCase();
    if (imageExtensions.some(ext => lowerFileName.endsWith(ext))) {
      return "image";
    }
  }

  return "file";
};

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
    const since = searchParams.get("since"); // ✅ 재연결 동기화를 위한 타임스탬프 파라미터
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

    // 메시지 조회 쿼리 구성
    let query = supabase
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
      .eq("room_id", room_id);

    // ✅ since 파라미터가 있으면 해당 시간 이후의 메시지만 조회 (재연결 동기화)
    if (since) {
      query = query.gt("created_at", since).order("created_at", { ascending: true });
    } else {
      // 일반 조회: 최신순 정렬 + 페이지네이션
      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    }

    // 메시지 조회
    const { data: messages, error } = await query.limit(limit);


    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // 메시지를 시간순으로 정렬하고 읽은 사용자 목록 처리
    // ✅ since 파라미터가 있으면 이미 ascending 정렬이므로 reverse 불필요
    const processedMessages = (messages as MessageWithSender[])
      ?.map((message) => ({
        ...message,
        read_by: message.reads?.map((read) => read.user_id) || []
      }))
      [since ? 'slice' : 'reverse'](0) || []; // since 있으면 그대로, 없으면 reverse

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

    let room_id: string;
    let content: string;
    let message_type: string = "text";
    let file_url: string | null = null;
    let file_name: string | null = null;
    let file_size: number | null = null;
    let reply_to_id: string | null = null;

    // Content-Type 확인하여 FormData 또는 JSON 처리
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // FormData 처리 (파일 업로드)
      const formData = await request.formData();
      room_id = formData.get('room_id') as string;
      content = formData.get('content') as string || '';
      reply_to_id = formData.get('reply_to_id') as string || null;

      const file = formData.get('file') as File | null;
      if (file) {
        // 파일 타입을 자동으로 판단
        message_type = getMessageType(file);
        file_name = file.name;
        file_size = file.size;

        // location 타입의 경우 파일 내용을 content로 읽어서 저장
        if (message_type === 'location') {
          try {
            const fileText = await file.text();
            content = fileText; // JSON 문자열을 content에 저장
          } catch (error) {
            console.error('Failed to read location file:', error);
          }
        }

        // 실제 파일 업로드 (이미지/파일)
        if (message_type === 'image' || message_type === 'file') {
          try {
            // 파일을 Blob으로 변환
            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: file.type });

            // 파일 경로 생성
            const ext = (file.name.split(".").pop() || "file").toLowerCase();
            const path = `chat/${user.id}/${Date.now()}.${ext}`;

            // Supabase Storage에 업로드
            const { error: uploadError } = await supabase.storage
              .from("posts")
              .upload(path, blob, {
                upsert: true,
                contentType: file.type,
                cacheControl: "3600",
              });

            if (uploadError) {
              console.error('File upload error:', uploadError);
              throw uploadError;
            }

            // 공개 URL 가져오기
            const { data: urlData } = supabase.storage
              .from("posts")
              .getPublicUrl(path);

            file_url = urlData.publicUrl;
          } catch (error) {
            console.error('Failed to upload file:', error);
            return NextResponse.json({ error: "파일 업로드 실패" }, { status: 500 });
          }
        }
      } else {
        // FormData로 전송된 message_type 사용 (fallback)
        message_type = formData.get('message_type') as string || 'text';
      }
    } else {
      // JSON 처리 (일반 메시지)
      const data: SendMessageData = await request.json();
      room_id = data.room_id;
      content = data.content;
      file_url = data.file_url || null;
      file_name = data.file_name || null;
      file_size = data.file_size || null;
      reply_to_id = data.reply_to_id || null;

      // 파일 정보가 있으면 타입을 자동으로 판단
      if (file_url || file_name) {
        message_type = getMessageType(undefined, file_name || undefined);
      } else {
        message_type = data.message_type || "text";
      }
    }

    if (!room_id || (!content && !file_url)) {
      return NextResponse.json({ error: "Room ID and content/file are required" }, { status: 400 });
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

    // ✅ Broadcast는 클라이언트에서 전송 (서버에서는 메시지 데이터만 반환)
    // 클라이언트(use-chat.ts, chat-layout.tsx)가 API 응답 후 Broadcast 전송

    return NextResponse.json({ message });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
















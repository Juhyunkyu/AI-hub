import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 메시지 읽음 상태 업데이트 - 최적화된 에러 처리
export async function POST(request: NextRequest) {
  try {
    // 요청 바디 파싱 및 검증
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { room_id, message_id } = requestBody;

    if (!room_id || typeof room_id !== 'string') {
      return NextResponse.json({ error: "Valid room ID is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    // Supabase 최적화: 참가자 검증을 위한 최적화된 쿼리
    const { data: participant, error: participantError } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .maybeSingle();

    // Supabase 에러 코드에 따른 세밀한 처리
    if (participantError) {
      if (participantError.code === 'PGRST116') {
        // No rows found - 참가자가 아님
        if (process.env.NODE_ENV === 'development') {
          console.warn(`User ${user.id} not a participant in room ${room_id}`);
        }
        return NextResponse.json({
          success: true,
          message: "Not a participant"
        });
      }

      // 기타 데이터베이스 에러
      if (process.env.NODE_ENV === 'development') {
        console.error("Database error checking participant:", {
          code: participantError.code,
          message: participantError.message,
          details: participantError.details
        });
      }

      return NextResponse.json({
        error: "Database connection error",
        code: participantError.code || 'UNKNOWN'
      }, { status: 500 });
    }

    // 참가자 확인 성공
    if (!participant) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`User ${user.id} query returned null for room ${room_id}`);
      }
      return NextResponse.json({
        success: true,
        message: "Access validation completed"
      });
    }

    // message_id가 제공되지 않으면 방의 최신 메시지를 가져옴
    let lastReadMessageId = message_id;
    if (!message_id) {
      const { data: latestMessage, error: messageError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', room_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // single() 대신 maybeSingle() 사용

      // 메시지가 없는 경우 (빈 방) 조용히 성공 처리
      if (messageError && messageError.code !== 'PGRST116') {
        console.error("Error fetching latest message:", messageError);
        return NextResponse.json({ error: "Failed to fetch latest message" }, { status: 500 });
      }

      lastReadMessageId = latestMessage?.id;

      // 메시지가 없는 방의 경우 읽을 메시지가 없으므로 성공 처리
      if (!lastReadMessageId) {
        return NextResponse.json({ success: true, message: "No messages to mark as read" });
      }
    }

    // Supabase 최적화: upsert를 사용한 읽음 상태 업데이트
    const now = new Date().toISOString();
    const { data: upsertData, error: upsertError } = await supabase
      .from('message_reads')
      .upsert({
        user_id: user.id,
        room_id: room_id,
        last_read_message_id: lastReadMessageId,
        last_read_at: now,
        updated_at: now
      }, {
        onConflict: 'user_id,room_id',
        ignoreDuplicates: false
      })
      .select('id');

    // Supabase upsert 에러 처리
    if (upsertError) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Upsert error details:", {
          code: upsertError.code,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint
        });
      }

      // PostgreSQL 에러 코드에 따른 처리
      switch (upsertError.code) {
        case '23503': // foreign_key_violation
          return NextResponse.json({
            success: true,
            message: "Invalid message reference",
            warning: "Message may not exist"
          });

        case '23505': // unique_violation
          return NextResponse.json({
            success: true,
            message: "Duplicate prevented, record exists"
          });

        case '42501': // insufficient_privilege
          return NextResponse.json({
            error: "Access denied",
            code: upsertError.code
          }, { status: 403 });

        default:
          return NextResponse.json({
            error: "Database update failed",
            code: upsertError.code || 'DB_ERROR'
          }, { status: 500 });
      }
    }

    const response = NextResponse.json({ success: true });

    // 성능 최적화 헤더 - 읽음 상태는 캐시하지 않음 (실시간성 중요)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  } catch (error) {
    // 에러 로깅 - 프로덕션에서는 민감한 정보 제외
    if (process.env.NODE_ENV === 'development') {
      console.error("API error in /api/chat/read:", error);
    } else {
      console.error("API error in /api/chat/read:", error instanceof Error ? error.message : 'Unknown error');
    }

    // 네트워크 관련 에러는 502로 처리
    if (error instanceof Error && (
      error.message.includes('network') ||
      error.message.includes('connection') ||
      error.message.includes('timeout')
    )) {
      return NextResponse.json({ error: "Network error" }, { status: 502 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 읽음 상태 조회
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const room_id = searchParams.get("room_id");

    if (room_id) {
      // 특정 방의 읽음 상태 조회 - 최적화된 컬럼 선택
      const { data, error } = await supabase
        .from('message_reads')
        .select('user_id, room_id, last_read_message_id, last_read_at, updated_at')
        .eq('user_id', user.id)
        .eq('room_id', room_id)
        .limit(1)
        .maybeSingle(); // single() 대신 maybeSingle() 사용

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error("Error fetching read status:", error);
        return NextResponse.json({ error: "Failed to fetch read status" }, { status: 500 });
      }

      return NextResponse.json({ readStatus: data });
    } else {
      // 모든 방의 읽음 상태 조회 - 최적화된 컬럼 선택 & 정렬
      const { data, error } = await supabase
        .from('message_reads')
        .select('user_id, room_id, last_read_message_id, last_read_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100); // 성능 최적화를 위한 합리적인 제한

      if (error) {
        console.error("Error fetching read statuses:", error);
        return NextResponse.json({ error: "Failed to fetch read statuses" }, { status: 500 });
      }

      return NextResponse.json({ readStatuses: data });
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
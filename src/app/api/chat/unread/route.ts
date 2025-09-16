import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 읽지 않은 메시지 카운트 조회 - 최적화된 에러 처리
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        hasUnreadMessages: false,
        totalUnreadCount: 0,
        roomCounts: [],
        error: "Authentication required"
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const room_id = searchParams.get("room_id");

    if (room_id) {
      // 특정 방의 읽지 않은 메시지 수 조회 - 최적화된 컬럼 선택
      const { data, error } = await supabase
        .from('unread_message_counts')
        .select('user_id, room_id, room_name, unread_count, latest_message_time')
        .eq('user_id', user.id)
        .eq('room_id', room_id)
        .limit(1)
        .maybeSingle(); // single() 대신 maybeSingle() 사용

      if (error && error.code !== 'PGRST116') {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error fetching unread count:", error);
        }
        return NextResponse.json({
          room_id,
          unreadCount: 0,
          latestMessageTime: null,
          error: "Failed to fetch unread count"
        }, { status: 500 });
      }

      const unreadCount = data?.unread_count || 0;
      const response = NextResponse.json({
        room_id,
        unreadCount,
        latestMessageTime: data?.latest_message_time || null
      });

      // 캐시 최적화 헤더 - 읽지 않은 메시지는 자주 변경될 수 있으므로 짧은 캐시
      response.headers.set('Cache-Control', 'private, max-age=10, must-revalidate');
      return response;
    } else {
      // 모든 방의 읽지 않은 메시지 수 조회 - 최적화된 컬럼 선택 & 정렬
      const { data, error } = await supabase
        .from('unread_message_counts')
        .select('user_id, room_id, room_name, unread_count, latest_message_time')
        .eq('user_id', user.id)
        .order('latest_message_time', { ascending: false })
        .limit(50); // 성능 최적화를 위한 합리적인 제한

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error fetching unread counts:", error);
        }
        // 에러 발생시에도 기본 응답 제공 (사용자 경험 향상)
        return NextResponse.json({
          hasUnreadMessages: false,
          totalUnreadCount: 0,
          roomCounts: [],
          error: "Failed to fetch unread counts"
        }, { status: 500 });
      }

      // 방별 카운트와 전체 카운트 계산 - null 체크 강화
      const roomCounts = Array.isArray(data) ? data : [];
      const totalUnreadCount = roomCounts.reduce((sum, room) => {
        const count = room?.unread_count || 0;
        return sum + (typeof count === 'number' ? count : 0);
      }, 0);

      // Nav바용 boolean 표시
      const hasUnreadMessages = totalUnreadCount > 0;

      const response = NextResponse.json({
        hasUnreadMessages,
        totalUnreadCount,
        roomCounts: roomCounts.map(room => ({
          room_id: room?.room_id || '',
          room_name: room?.room_name || 'Unknown Room',
          unreadCount: room?.unread_count || 0,
          latestMessageTime: room?.latest_message_time || null
        }))
      });

      // 캐시 최적화 헤더 - 실시간 특성 고려한 짧은 캐시
      response.headers.set('Cache-Control', 'private, max-age=15, must-revalidate');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      return response;
    }
  } catch (error) {
    // 에러 로깅 - 프로덕션에서는 민감한 정보 제외
    if (process.env.NODE_ENV === 'development') {
      console.error("API error in /api/chat/unread:", error);
    } else {
      console.error("API error in /api/chat/unread:", error instanceof Error ? error.message : 'Unknown error');
    }

    // 에러 발생시에도 기본 알림 상태 제공 (사용자 경험 향상)
    return NextResponse.json({
      hasUnreadMessages: false,
      totalUnreadCount: 0,
      roomCounts: [],
      error: "Internal server error"
    }, { status: 500 });
  }
}
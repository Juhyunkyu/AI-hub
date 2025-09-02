import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TypingStatusData } from "@/types/chat";

// 타이핑 상태 조회
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

    if (!room_id) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    // 타이핑 상태 조회 (자신 제외)
    const { data: typingStatus, error } = await supabase
      .from("chat_typing_status")
      .select(`
        *,
        user:profiles(id, username, avatar_url)
      `)
      .eq("room_id", room_id)
      .eq("is_typing", true)
      .neq("user_id", user.id)
      .gt("last_activity", new Date(Date.now() - 5000).toISOString()); // 5초 이내

    if (error) {
      console.error("Error fetching typing status:", error);
      return NextResponse.json({ error: "Failed to fetch typing status" }, { status: 500 });
    }

    return NextResponse.json({ typingStatus: typingStatus || [] });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 타이핑 상태 업데이트
export async function POST(request: NextRequest) {
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

    const { room_id, is_typing }: TypingStatusData = await request.json();

    if (!room_id) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    if (is_typing) {
      // 타이핑 시작 또는 업데이트
      const { error } = await supabase
        .from("chat_typing_status")
        .upsert({
          room_id,
          user_id: user.id,
          is_typing: true,
          last_activity: new Date().toISOString()
        });

      if (error) {
        console.error("Error updating typing status:", error);
        return NextResponse.json({ error: "Failed to update typing status" }, { status: 500 });
      }
    } else {
      // 타이핑 중지
      const { error } = await supabase
        .from("chat_typing_status")
        .delete()
        .eq("room_id", room_id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error removing typing status:", error);
        return NextResponse.json({ error: "Failed to remove typing status" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

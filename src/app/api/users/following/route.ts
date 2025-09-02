import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 팔로우하는 사용자들 가져오기
    const { data: followingUsers, error } = await supabase
      .from("follows")
      .select(`
        following_id,
        profiles:following_id (
          id,
          username,
          bio,
          avatar_url
        )
      `)
      .eq("follower_id", user.id)
      .not("following_id", "is", null);

    if (error) {
      console.error("Error fetching following users:", error);
      return NextResponse.json({ error: "Failed to fetch following users" }, { status: 500 });
    }

    // 프로필 데이터만 추출
    const users = followingUsers
      ?.map(follow => follow.profiles)
      .filter(profile => profile !== null) || [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error in following API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
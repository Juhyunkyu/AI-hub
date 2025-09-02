import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    // 팔로우 관계 확인
    const { data: existingFollow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (existingFollow) {
      // 언팔로우
      const { error: deleteError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);

      if (deleteError) {
        console.error("Unfollow error:", deleteError);
        return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
      }

      return NextResponse.json({ action: "unfollowed" });
    } else {
      // 팔로우
      const { error: insertError } = await supabase
        .from("follows")
        .insert({
          follower_id: user.id,
          following_id: targetUserId,
        });

      if (insertError) {
        console.error("Follow error:", insertError);
        return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
      }

      return NextResponse.json({ action: "followed" });
    }
  } catch (error) {
    console.error("Follow API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");
    const type = searchParams.get("type"); // "followers" or "following"

    if (!targetUserId || !type) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    let followsData;
    if (type === "followers") {
      // 팔로워 목록 (나를 팔로우하는 사람들)
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("follower_id, created_at")
        .eq("following_id", targetUserId)
        .order("created_at", { ascending: false });

      if (followsError) {
        console.error("Get followers error:", followsError);
        return NextResponse.json({ error: "Failed to get followers" }, { status: 500 });
      }

      // 팔로워들의 프로필 정보 가져오기
      const followerIds = follows.map(f => f.follower_id);
      if (followerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, bio")
          .in("id", followerIds);

        if (profilesError) {
          console.error("Get profiles error:", profilesError);
          return NextResponse.json({ error: "Failed to get profiles" }, { status: 500 });
        }

        // follows와 profiles 데이터 결합
        followsData = follows.map(follow => ({
          ...follow,
          profile: profiles.find(p => p.id === follow.follower_id)
        }));
      } else {
        followsData = [];
      }
    } else if (type === "following") {
      // 팔로잉 목록 (내가 팔로우하는 사람들)
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("following_id, created_at")
        .eq("follower_id", targetUserId)
        .order("created_at", { ascending: false });

      if (followsError) {
        console.error("Get following error:", followsError);
        return NextResponse.json({ error: "Failed to get following" }, { status: 500 });
      }

      // 팔로잉하는 사람들의 프로필 정보 가져오기
      const followingIds = follows.map(f => f.following_id);
      if (followingIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, bio")
          .in("id", followingIds);

        if (profilesError) {
          console.error("Get profiles error:", profilesError);
          return NextResponse.json({ error: "Failed to get profiles" }, { status: 500 });
        }

        // follows와 profiles 데이터 결합
        followsData = follows.map(follow => ({
          ...follow,
          profile: profiles.find(p => p.id === follow.following_id)
        }));
      } else {
        followsData = [];
      }
    } else {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }

    return NextResponse.json({ data: followsData });
  } catch (error) {
    console.error("Get follows API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

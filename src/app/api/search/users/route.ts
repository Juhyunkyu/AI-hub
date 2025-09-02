import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  is_following?: boolean;
  is_follower?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const includeFollows = searchParams.get("includeFollows") === "true";

    let users: UserProfile[] = [];

    if (!query.trim() && includeFollows) {
      // 검색어가 없고 팔로우 포함이 요청된 경우, 팔로잉하는 사용자들을 먼저 보여줌
      const { data: followingUsers, error: followingError } = await supabase
        .from("follows")
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            username,
            avatar_url,
            bio
          )
        `)
        .eq("follower_id", user.id)
        .limit(limit);

      if (followingError) {
        console.error("Error fetching following users:", followingError);
      } else if (followingUsers) {
        users = followingUsers
          .filter(follow => follow.profiles)
          .map(follow => ({
            ...follow.profiles,
            is_following: true,
            is_follower: false
          })) as UserProfile[];
      }
    } else if (query.trim()) {
      // 검색어가 있는 경우 사용자 검색
      const { data: searchResults, error: searchError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio")
        .neq("id", user.id) // 현재 사용자 제외
        .or(`username.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(limit);

      if (searchError) {
        console.error("Error searching users:", searchError);
        return NextResponse.json(
          { error: "Failed to search users" },
          { status: 500 }
        );
      }

      if (searchResults) {
        // 검색된 사용자들의 팔로우 상태 확인
        const userIds = searchResults.map(u => u.id);
        
        // 내가 팔로우하는 사용자들 확인
        const { data: followingData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .in("following_id", userIds);

        // 나를 팔로우하는 사용자들 확인
        const { data: followersData } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", user.id)
          .in("follower_id", userIds);

        const followingIds = new Set(followingData?.map(f => f.following_id) || []);
        const followerIds = new Set(followersData?.map(f => f.follower_id) || []);

        users = searchResults.map(user => ({
          ...user,
          is_following: followingIds.has(user.id),
          is_follower: followerIds.has(user.id)
        }));

        // 팔로우 관계가 있는 사용자들을 먼저 정렬
        users.sort((a, b) => {
          const aHasRelation = a.is_following || a.is_follower;
          const bHasRelation = b.is_following || b.is_follower;
          
          if (aHasRelation && !bHasRelation) return -1;
          if (!aHasRelation && bHasRelation) return 1;
          
          // 팔로우 관계가 같다면 사용자명으로 정렬
          return a.username.localeCompare(b.username);
        });
      }
    }

    return NextResponse.json({ 
      users: users || [],
      hasQuery: !!query.trim(),
      includeFollows 
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
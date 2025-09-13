import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 채팅 초대용 사용자 검색
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all"; // all, followers, following
    const userId = searchParams.get("user_id"); // 특정 사용자 ID로 검색
    const limit = parseInt(searchParams.get("limit") || "20");

    let users: any[] = [];

    if (type === "followers") {
      // 나를 팔로우하는 사용자들
      const { data, error } = await supabase
        .from("follows")
        .select(`
          follower:profiles!follows_follower_id_fkey(
            id,
            username,
            avatar_url,
            bio
          )
        `)
        .eq("following_id", user.id)
        .ilike("follower.username", `%${query}%`)
        .limit(limit);

      if (error) {
        console.error("Error fetching followers:", error);
        return NextResponse.json({ error: "Failed to fetch followers" }, { status: 500 });
      }

      users = data?.map((item: any) => item.follower).filter(Boolean) || [];
    } else if (type === "following") {
      // 내가 팔로우하는 사용자들
      const { data, error } = await supabase
        .from("follows")
        .select(`
          following:profiles!follows_following_id_fkey(
            id,
            username,
            avatar_url,
            bio
          )
        `)
        .eq("follower_id", user.id)
        .ilike("following.username", `%${query}%`)
        .limit(limit);

      if (error) {
        console.error("Error fetching following:", error);
        return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
      }

      users = data?.map((item: any) => item.following).filter(Boolean) || [];
    } else {
      // 특정 사용자 ID로 검색하는 경우
      if (userId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, bio")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Error fetching user by ID:", error);
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        users = data ? [data] : [];
      } else {
        // 모든 사용자 검색 (공개 프로필만)
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, bio")
          .eq("is_public", true)
          .neq("id", user.id)
          .ilike("username", `%${query}%`)
          .limit(limit);

        if (error) {
          console.error("Error searching users:", error);
          return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
        }

        users = data || [];
      }
    }

    // 각 사용자와의 기존 채팅방 여부 확인
    const usersWithChatStatus = await Promise.all(
      users.map(async (searchUser: any) => {
        try {
          let existingRoom = null;

          // 본인과의 채팅방인 경우 self 타입 확인
          if (searchUser.id === user.id) {
            const { data: selfRooms } = await supabase
              .from("chat_rooms")
              .select(`
                id,
                participants:chat_room_participants(user_id)
              `)
              .eq("type", "self");

            existingRoom = selfRooms?.find((room: any) => {
              const participantIds = room.participants?.map((p: unknown) => p.user_id) || [];
              return participantIds.length === 1 && participantIds.includes(user.id);
            });
          } else {
            // 다른 사용자와의 direct 채팅방 확인
            const { data: directRooms } = await supabase
              .from("chat_rooms")
              .select(`
                id,
                participants:chat_room_participants(user_id)
              `)
              .eq("type", "direct");

            existingRoom = directRooms?.find((room: any) => {
              const participantIds = room.participants?.map((p: unknown) => p.user_id) || [];
              return participantIds.length === 2 &&
                     participantIds.includes(user.id) &&
                     participantIds.includes(searchUser.id);
            });
          }

          return {
            ...searchUser,
            has_chat: !!existingRoom,
            chat_room_id: existingRoom?.id || null
          };
        } catch (error) {
          console.error("Error checking chat status for user:", searchUser.id, error);
          return {
            ...searchUser,
            has_chat: false,
            chat_room_id: null
          };
        }
      })
    );

    return NextResponse.json({
      users: usersWithChatStatus,
      query,
      type
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    // 현재 로그인한 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 현재 사용자의 profile 확인
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error("Error fetching profile:", profileError);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    let profileAction = 'none';
    let profileData = existingProfile;

    // Profile이 없으면 생성
    if (!existingProfile) {
      const username = user.user_metadata?.username ||
                      user.email?.split('@')[0] ||
                      `user_${user.id.substring(0, 8)}`;

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: username,
          role: 'user'
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating profile:", insertError);
        return NextResponse.json({
          error: "Failed to create profile",
          details: insertError.message
        }, { status: 500 });
      }

      profileAction = 'created';
      profileData = newProfile;
    }
    // Profile은 있지만 username이 비어있으면 업데이트
    else if (!existingProfile.username || existingProfile.username.trim() === '') {
      const username = user.user_metadata?.username ||
                      user.email?.split('@')[0] ||
                      `user_${user.id.substring(0, 8)}`;

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return NextResponse.json({
          error: "Failed to update profile",
          details: updateError.message
        }, { status: 500 });
      }

      profileAction = 'updated';
      profileData = updatedProfile;
    }

    return NextResponse.json({
      success: true,
      message: `Profile ${profileAction} successfully`,
      action: profileAction,
      profile: profileData,
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({
      error: "Unexpected error occurred",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
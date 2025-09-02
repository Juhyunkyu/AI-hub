import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("targetId");
    const targetType = searchParams.get("targetType");

    if (!targetId || !targetType) {
      return NextResponse.json(
        { error: "targetId와 targetType이 필요합니다" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 신고 기록 확인
    const { data: report, error } = await supabase
      .from("reports")
      .select("id, status, created_at")
      .eq("target_id", targetId)
      .eq("target_type", targetType)
      .eq("reporter_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json(
        { error: "신고 상태 확인 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasReported: !!report,
      reportId: report?.id || null,
      status: report?.status || null,
      reportedAt: report?.created_at || null,
    });
  } catch (error) {
    console.error("신고 상태 확인 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

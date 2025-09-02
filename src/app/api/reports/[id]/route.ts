import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 신고 기록 확인 (본인이 신고한 것만 삭제 가능)
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("id, reporter_id, status")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "신고를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (report.reporter_id !== user.id) {
      return NextResponse.json(
        { error: "본인이 신고한 것만 해제할 수 있습니다" },
        { status: 403 }
      );
    }

    // 이미 처리된 신고는 삭제 불가
    if (report.status !== "open") {
      return NextResponse.json(
        { error: "이미 처리된 신고는 해제할 수 없습니다" },
        { status: 400 }
      );
    }

    // 신고 삭제
    const { error: deleteError } = await supabase
      .from("reports")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "신고 해제 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("신고 해제 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

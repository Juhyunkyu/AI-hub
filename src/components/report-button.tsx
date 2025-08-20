"use client";

import { Button } from "@/components/ui/button";
import { Flag, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ReportButton({
  targetId,
  targetType,
}: {
  targetId: string;
  targetType: "post" | "comment";
}) {
  const supabase = createSupabaseBrowserClient();
  const user = useAuthStore((s) => s.user);
  const [hasReported, setHasReported] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasChecked = useRef(false);

  // 신고 상태 확인 함수
  const checkReportStatus = async () => {
    if (!user) {
      setChecking(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/reports/check?targetId=${targetId}&targetType=${targetType}`
      );
      const data = await response.json();

      if (response.ok) {
        setHasReported(data.hasReported);
        setReportId(data.reportId);
      }
    } catch (error) {
      console.error("신고 상태 확인 오류:", error);
    } finally {
      setChecking(false);
    }
  };

  // 초기 상태 확인 (한 번만 실행)
  useEffect(() => {
    if (!user || hasChecked.current) {
      setChecking(false);
      return;
    }

    checkReportStatus();
    hasChecked.current = true;
  }, [targetId, targetType, user]);

  async function report() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }

    setLoading(true);
    try {
      // INSERT 방식으로 신고 생성
      const { data, error } = await supabase
        .from("reports")
        .insert({
          target_id: targetId,
          target_type: targetType,
          reporter_id: user.id,
          reason: "user_report",
          status: "open",
        })
        .select("id")
        .single();

      if (error) {
        // 이미 신고한 경우 에러 처리
        if (error.code === "23505") {
          toast.error("이미 신고한 게시물입니다");
          return;
        }
        throw error;
      }

      setHasReported(true);
      setReportId(data.id);
      setDialogOpen(false);
      toast.success("신고가 접수되었습니다");
    } catch (error: any) {
      toast.error(error.message || "신고 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="h-8 px-2 text-xs text-muted-foreground"
      >
        <Flag className="mr-1 h-4 w-4" /> 확인 중...
      </Button>
    );
  }

  return (
    <>
      {hasReported ? (
        <Button
          variant="default"
          size="sm"
          disabled
          className="h-8 px-2 text-xs bg-green-600 text-white cursor-not-allowed"
        >
          <Check className="mr-1 h-4 w-4" /> 신고됨
        </Button>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Flag className="mr-1 h-4 w-4" /> 신고
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>신고하기</DialogTitle>
              <DialogDescription>
                이 게시물을 신고하시겠습니까? 신고는 한 번만 가능하며, 신고
                후에는 취소할 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button
                onClick={report}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700"
              >
                신고하기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

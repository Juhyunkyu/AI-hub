"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ProfileSetupPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  // 에러 메시지를 한국어로 변환하는 함수
  function getErrorMessage(error: any): string {
    const message = error?.message || "";

    if (message.includes("duplicate key")) {
      return "이미 사용 중인 닉네임입니다";
    }
    if (message.includes("violates check constraint")) {
      return "닉네임 형식이 올바르지 않습니다";
    }
    if (message.includes("Network error")) {
      return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요";
    }

    return "닉네임 설정 중 오류가 발생했습니다";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("닉네임을 입력하세요");
      return;
    }

    if (username.length < 2) {
      toast.error("닉네임은 2자 이상이어야 합니다");
      return;
    }

    setLoading(true);

    try {
      // 사용자 정보 가져오기
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인이 필요합니다");
        router.push("/login");
        return;
      }

      // 닉네임 중복 확인
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.trim())
        .neq("id", user.id)
        .maybeSingle();

      if (existingUser) {
        toast.error("이미 사용 중인 닉네임입니다");
        setLoading(false);
        return;
      }

      // 프로필 업데이트
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("id", user.id);

      if (error) {
        console.error("Profile update error:", error);
        toast.error(getErrorMessage(error));
        setLoading(false);
        return;
      }

      toast.success("닉네임이 설정되었습니다!");
      router.push(`/profile/${encodeURIComponent(username.trim())}`);
    } catch (error) {
      console.error("Setup error:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>닉네임 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="text-sm font-medium">
                닉네임
              </label>
              <Input
                id="username"
                type="text"
                placeholder="사용할 닉네임을 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground mt-1">
                2-20자, 한글/영문/숫자 사용 가능
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "설정 중..." : "닉네임 설정"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

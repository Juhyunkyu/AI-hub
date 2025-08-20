"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SocialButtons } from "@/components/auth/social-buttons";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string>("/");

  // URL 파라미터에서 리다이렉트 경로 가져오기
  useEffect(() => {
    const redirect = searchParams.get("redirect");
    if (redirect) {
      setRedirectTo(decodeURIComponent(redirect));
    }
  }, [searchParams]);

  // 에러 메시지를 한국어로 변환하는 함수
  function getErrorMessage(error: unknown): string {
    const message =
      (error && typeof error === "object" && "message" in error
        ? (error as { message?: string }).message
        : "") || "";

    // 로그인 관련 에러
    if (message.includes("Invalid login credentials")) {
      return "이메일 또는 비밀번호가 올바르지 않습니다";
    }
    if (message.includes("Email not confirmed")) {
      return "이메일 인증이 필요합니다. 이메일을 확인해주세요";
    }
    if (message.includes("Too many requests")) {
      return "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요";
    }

    // 회원가입 관련 에러
    if (message.includes("User already registered")) {
      return "이미 가입된 이메일입니다";
    }
    if (message.includes("Password should be at least")) {
      return "비밀번호는 6자 이상이어야 합니다";
    }
    if (message.includes("Invalid email")) {
      return "올바른 이메일 형식을 입력해주세요";
    }

    // 기타 에러
    if (message.includes("Network error")) {
      return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요";
    }

    // 기본 에러 메시지
    return "오류가 발생했습니다. 다시 시도해주세요";
  }

  async function onSubmit() {
    if (!email.trim() || !password) {
      toast.error("이메일과 비밀번호를 입력하세요");
      return;
    }
    if (mode === "signup") {
      if (!username.trim()) {
        toast.error("닉네임을 입력하세요");
        return;
      }
      if (username.length < 2) {
        toast.error("닉네임은 2자 이상이어야 합니다");
        return;
      }
      if (password.length < 6) {
        toast.error("비밀번호는 6자 이상이어야 합니다");
        return;
      }
      if (password !== confirm) {
        toast.error("비밀번호 확인이 일치하지 않습니다");
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
          },
        },
      });
      setLoading(false);
      if (error) return toast.error(getErrorMessage(error));
      toast.success("가입 메일을 확인하세요");
      return;
    }

    // login
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return toast.error(getErrorMessage(error));
    router.push(redirectTo);
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <h1 className="text-lg font-semibold">
        {mode === "login" ? "로그인" : "회원가입"}
      </h1>
      <div className="space-y-2">
        <Input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode === "signup" && (
          <Input
            type="text"
            placeholder="닉네임 (2자 이상)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "signup" && (
          <Input
            type="password"
            placeholder="비밀번호 확인"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <Button
            onClick={onSubmit}
            disabled={loading}
            className={
              mode === "login"
                ? "flex-1 bg-zinc-900 text-white hover:bg-zinc-800"
                : "flex-1"
            }
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "회원가입으로 전환" : "로그인으로 전환"}
          </Button>
        </div>
      </div>
      <div className="pt-2">
        <SocialButtons />
      </div>
    </div>
  );
}

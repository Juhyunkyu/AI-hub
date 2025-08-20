"use client";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCallback } from "react";
import { Github } from "lucide-react";

type Provider = "google" | "github" | "kakao" | "naver";

function GoogleIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={props.className}
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.8 3 14.6 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c6.5 0 9-4.6 9-7 0-.5 0-.8-.1-1.2H12z"
      />
      <path
        fill="#34A853"
        d="M3.2 7.9l3.2 2.3C7.3 8 9.5 6.4 12 6.4c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.8 3 14.6 2 12 2 8.2 2 5 4.2 3.2 7.9z"
      />
      <path
        fill="#FBBC05"
        d="M12 20.4c3 0 5.5-1 7.3-2.8l-3.4-2.8c-1 .7-2.3 1.2-3.9 1.2-3.8 0-7-3.1-7-6.9 0-1.1.3-2.1.7-3L3.2 7.9C2.5 9.4 2.4 10.3 2.4 11.2 2.4 16.3 6.5 20.4 12 20.4z"
      />
      <path
        fill="#4285F4"
        d="M21 11.2c0-.5 0-.8-.1-1.2H12v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-2.3 0-4.3-1.2-5.3-3l-3.2 2.4C5 19.3 8.2 21 12 21c6.5 0 9-4.6 9-7z"
      />
    </svg>
  );
}

function KakaoIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={props.className}
    >
      <path
        d="M12 4c-4.4 0-8 2.7-8 6.1 0 2.1 1.4 3.9 3.6 5l-.9 3.3c-.1.5.4.9.9.6l3.7-2.2c.2 0 .5.1.8.1 4.4 0 8-2.7 8-6.1S16.4 4 12 4z"
        fill="#000000"
      />
    </svg>
  );
}

function NaverIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={props.className}
    >
      <path d="M4 4h5.6l4.8 7.2V4H20v16h-5.6l-4.8-7.2V20H4z" fill="#FFFFFF" />
    </svg>
  );
}

export function SocialButtons() {
  const supabase = createSupabaseBrowserClient();

  // 에러 메시지를 한국어로 변환하는 함수
  function getErrorMessage(error: any): string {
    const message = error?.message || "";

    if (message.includes("OAuth error")) {
      return "소셜 로그인 중 오류가 발생했습니다";
    }
    if (message.includes("User already registered")) {
      return "이미 가입된 계정입니다";
    }
    if (message.includes("Email not confirmed")) {
      return "이메일 인증이 필요합니다";
    }

    return "소셜 로그인 중 오류가 발생했습니다";
  }

  const login = useCallback(
    async (provider: Provider) => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo:
              typeof window !== "undefined"
                ? window.location.origin
                : undefined,
          },
        });

        if (error) {
          console.error("Social login error:", error);
          // toast는 여기서 사용할 수 없으므로 에러 로깅만
        }
      } catch (error) {
        console.error("Social login error:", error);
      }
    },
    [supabase]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Button
        onClick={() => login("google")}
        aria-label="Google로 계속하기"
        className="h-9 justify-center gap-2 border bg-gray-50 text-gray-900 shadow-sm hover:bg-gray-100 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
      >
        <GoogleIcon className="h-4 w-4" />
        Google로 계속하기
      </Button>
      <Button
        onClick={() => login("github")}
        aria-label="GitHub로 계속하기"
        variant="default"
        className="h-9 justify-center gap-2"
      >
        <Github className="h-4 w-4" />
        GitHub로 계속하기
      </Button>
      <Button
        onClick={() => login("kakao")}
        aria-label="Kakao로 계속하기"
        className="h-9 justify-center gap-2 border-0 bg-[#FEE500] text-black shadow-sm hover:shadow"
      >
        <KakaoIcon className="h-4 w-4" />
        Kakao로 계속하기
      </Button>
      <Button
        onClick={() => login("naver")}
        aria-label="Naver로 계속하기"
        className="h-9 justify-center gap-2 border-0 bg-[#03C75A] text-white shadow-sm hover:shadow"
      >
        <NaverIcon className="h-4 w-4" />
        Naver로 계속하기
      </Button>
    </div>
  );
}

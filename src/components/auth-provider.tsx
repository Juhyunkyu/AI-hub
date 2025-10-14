"use client";

import { useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

// 전역 이벤트 리스너 (HMR 문제 해결)
let authListener: {
  data: { subscription: { unsubscribe: () => void } };
} | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuth, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    // 기존 리스너가 있으면 제거
    if (authListener) {
      authListener.data.subscription.unsubscribe();
    }

    // 초기 인증 상태 확인
    checkAuth();

    // 인증 상태 변경 감지
    authListener = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        // session.user를 사용하여 상태 업데이트
        const user = session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
            }
          : null;
        setUser(user);

        // 프로필은 Database Trigger (handle_new_user)가 회원가입 시 자동 생성하므로
        // 여기서 upsert 불필요
      } else if (event === "SIGNED_OUT") {
        // 로그아웃 시 상태 초기화 및 리다이렉트
        setUser(null);

        if (pathname !== "/") {
          router.replace("/");
        }
      } else if (event === "TOKEN_REFRESHED") {
        checkAuth();
      }
    });

    return () => {
      // 컴포넌트 언마운트 시에도 리스너는 유지 (HMR 때문)
    };
  }, [checkAuth, setUser, supabase, router, pathname]);

  return <>{children}</>;
}

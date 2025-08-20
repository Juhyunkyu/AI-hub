"use client";

import React from "react";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { mounted } = useTheme();
  const user = useAuthStore((s) => s.user);
  const supabase = createSupabaseBrowserClient();

  // 앱 시작 시 저장된 테마 적용
  React.useEffect(() => {
    const loadColorTheme = async () => {
      // 로그인한 사용자인 경우 데이터베이스에서 색상 테마 로드
      if (user) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("color_theme")
            .eq("id", user.id)
            .single();

          if (!error && data?.color_theme) {
            const savedColor = data.color_theme;
            if (savedColor && savedColor !== "base") {
              document.documentElement.setAttribute("data-theme", savedColor);
            } else if (savedColor === "base") {
              document.documentElement.removeAttribute("data-theme");
            }
            return;
          }
        } catch (error) {
          console.error("색상 테마 로드 실패:", error);
        }
      }

      // 로컬 스토리지에서 색상 테마 로드 (fallback)
      const savedColor = localStorage.getItem("color-theme");
      if (savedColor && savedColor !== "base") {
        document.documentElement.setAttribute("data-theme", savedColor);
      } else if (savedColor === "base") {
        document.documentElement.removeAttribute("data-theme");
      }
    };

    loadColorTheme();
  }, [user, supabase]);

  // 마운트 전까지는 기본 테마로 렌더링
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  const supabase = createSupabaseBrowserClient();

  // 시스템 테마 감지
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  // 실제 적용될 테마 계산
  const getActualTheme = useCallback((): "light" | "dark" => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  }, [theme]);

  // 테마 변경 함수
  const changeTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    
    // 로컬 스토리지에 저장 (즉시 적용)
    localStorage.setItem("theme", newTheme);
    
    // 로그인한 사용자인 경우 데이터베이스에 저장
    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ theme_preference: newTheme })
          .eq("id", user.id);
      } catch (error) {
        console.error("테마 설정 저장 실패:", error);
      }
    }
  };

  // 초기 테마 로드
  useEffect(() => {
    const loadTheme = async () => {
      // 로그인한 사용자인 경우 데이터베이스에서 테마 설정 로드
      if (user) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("theme_preference")
            .eq("id", user.id)
            .single();

          if (!error && data?.theme_preference) {
            setTheme(data.theme_preference as Theme);
            localStorage.setItem("theme", data.theme_preference);
            setMounted(true);
            return;
          }
        } catch (error) {
          console.error("테마 설정 로드 실패:", error);
        }
      }

      // 로컬 스토리지에서 테마 설정 로드
      const savedTheme = localStorage.getItem("theme") as Theme;
      if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
        setTheme(savedTheme);
      }
      
      setMounted(true);
    };

    loadTheme();
  }, [user, supabase]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const actualTheme = getActualTheme();
      document.documentElement.classList.toggle("dark", actualTheme === "dark");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, getActualTheme]);

  // 테마 변경 시 DOM 업데이트
  useEffect(() => {
    if (!mounted) return;

    const actualTheme = getActualTheme();
    document.documentElement.classList.toggle("dark", actualTheme === "dark");
  }, [theme, mounted, getActualTheme]);

  // 로그아웃 시 theme:reset 이벤트로 기본값 초기화
  useEffect(() => {
    const handleReset = () => {
      setTheme("light");
      try {
        localStorage.removeItem("theme");
      } catch {}
    };
    if (typeof window !== "undefined") {
      window.addEventListener("theme:reset", handleReset);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("theme:reset", handleReset);
      }
    };
  }, []);

  return {
    theme,
    changeTheme,
    getActualTheme,
    mounted,
  };
}

"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Color =
  | "base"
  | "red"
  | "rose"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "violet";

const COLORS = [
  "base",
  "red",
  "rose",
  "orange",
  "yellow",
  "green",
  "blue",
  "violet",
] as const;

type Mode = "light" | "dark";

const PREVIEW: Record<Exclude<Color, "base">, string> = {
  red: "#ef4444",
  rose: "#f43f5e",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  violet: "#8b5cf6",
};

export function ColorThemeSwitcher() {
  const { theme, changeTheme, getActualTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("light");
  const [color, setColor] = useState<Color>("base");
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  const supabase = createSupabaseBrowserClient();

  // Sync local mode state with current theme
  useEffect(() => {
    const current = (getActualTheme() === "dark" ? "dark" : "light") as Mode;
    setMode(current);
  }, [theme, getActualTheme]);

  // Load color theme from database or localStorage
  useEffect(() => {
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
            const savedColor = data.color_theme as Color;
            if ((COLORS as readonly string[]).includes(savedColor)) {
              setColor(savedColor);
              applyColorToDOM(savedColor);
              setMounted(true);
              return;
            }
          }
        } catch (error) {
          console.error("색상 테마 로드 실패:", error);
        }
      }

      // 로컬 스토리지에서 색상 테마 로드 (fallback)
      const savedColor = (typeof window !== "undefined" &&
        localStorage.getItem("color-theme")) as Color | null;
      if (savedColor && (COLORS as readonly string[]).includes(savedColor)) {
        setColor(savedColor as Color);
        applyColorToDOM(savedColor);
      }

      setMounted(true);
    };

    loadColorTheme();
  }, [user, supabase]);

  // DOM에 색상 테마 적용하는 헬퍼 함수
  const applyColorToDOM = (colorTheme: Color) => {
    if (colorTheme === "base") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", colorTheme);
    }
  };

  function applyMode(next: Mode) {
    setMode(next);
    changeTheme(next);
  }

  async function applyColor(next: Color) {
    setColor(next);
    applyColorToDOM(next);

    // 로컬 스토리지에 저장 (즉시 적용)
    try {
      localStorage.setItem("color-theme", next);
    } catch {}

    // 로그인한 사용자인 경우 데이터베이스에 저장
    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ color_theme: next })
          .eq("id", user.id);
      } catch (error) {
        console.error("색상 테마 저장 실패:", error);
      }
    }
  }

  const baseBg =
    mode === "dark"
      ? "repeating-linear-gradient(45deg, #3f3f46 0 6px, #27272a 6px 12px)"
      : "repeating-linear-gradient(45deg, #e5e7eb 0 6px, #f3f4f6 6px 12px)";

  // 마운트 전까지는 기본 상태로 렌더링
  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 rounded border text-xs bg-muted">
            Light
          </button>
          <button className="h-8 px-3 rounded border text-xs bg-muted">
            Dark
          </button>
          <button className="h-8 px-3 rounded border text-xs bg-muted">
            System
          </button>
        </div>
        <div className="flex flex-wrap gap-8 items-center">
          <button className="relative h-9 w-9 rounded-full border bg-muted" />
          {COLORS.filter((c) => c !== "base").map((c) => (
            <button
              key={c}
              className="relative h-9 w-9 rounded-full border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <button
          aria-label="라이트 모드"
          onClick={() => applyMode("light")}
          className={`h-6 px-2 rounded border text-xs ${mode === "light" ? "bg-background" : "bg-muted"}`}
        >
          Light
        </button>
        <button
          aria-label="다크 모드"
          onClick={() => applyMode("dark")}
          className={`h-6 px-2 rounded border text-xs ${mode === "dark" ? "bg-background" : "bg-muted"}`}
        >
          Dark
        </button>
        <button
          aria-label="시스템 테마"
          onClick={() => changeTheme("system")}
          className={`h-6 px-2 rounded border text-xs ${theme === "system" ? "bg-background" : "bg-muted"}`}
        >
          System
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex gap-6 items-center">
          <button
            aria-label="기본"
            onClick={() => applyColor("base")}
            className={`relative h-6 w-6 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 ${color === "base" ? "ring-2 ring-ring" : ""}`}
            style={{ background: baseBg }}
            title="기본 (시스템 기본 색상)"
          >
            <span className="sr-only">기본</span>
          </button>
          {(COLORS.filter((c) => c !== "base") as Exclude<Color, "base">[])
            .slice(0, 3)
            .map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => applyColor(c)}
                className={`relative h-6 w-6 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 ${color === c ? "ring-2 ring-ring" : ""}`}
                style={{ background: PREVIEW[c] }}
                title={c}
              />
            ))}
        </div>
        <div className="flex gap-6 items-center">
          {(COLORS.filter((c) => c !== "base") as Exclude<Color, "base">[])
            .slice(3, 7)
            .map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => applyColor(c)}
                className={`relative h-6 w-6 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 ${color === c ? "ring-2 ring-ring" : ""}`}
                style={{ background: PREVIEW[c] }}
                title={c}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

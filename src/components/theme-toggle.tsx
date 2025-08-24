"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, changeTheme, getActualTheme } = useTheme();
  const isDark = getActualTheme() === "dark";
  // 전환 대상 아이콘을 보여준다: 라이트이면 달(다크로 전환), 다크이면 해(라이트로 전환)
  const showMoon = !isDark;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => changeTheme(isDark ? "light" : "dark")}
    >
      {showMoon ? (
        <Moon className="size-5 rotate-0 scale-100 transition-all" />
      ) : (
        <Sun className="size-5 rotate-0 scale-100 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

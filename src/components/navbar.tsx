"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import {
  LogIn,
  User as UserIcon,
  Shield,
  Inbox,
  Settings,
  LogOut,
  ChevronDown,
  Grid3X3,
} from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
};

export function Navbar() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // 클라이언트 마운트 확인
  useEffect(() => {
    setMounted(true);
  }, []);

  // 카테고리 로드
  useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await supabase
          .from("categories")
          .select(
            "id, slug, name, description, icon, color, sort_order, created_at"
          )
          .order("sort_order");
        setCategories(data || []);
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    }
    loadCategories();
  }, [supabase]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      // 사용자 메뉴 외부 클릭 체크
      if (
        showUserMenu &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        userDropdownRef.current &&
        !userDropdownRef.current.contains(target)
      ) {
        setShowUserMenu(false);
      }

      // 카테고리 메뉴 외부 클릭 체크
      if (
        showCategoryMenu &&
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(target) &&
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(target)
      ) {
        setShowCategoryMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu, showCategoryMenu]);

  // ESC 키로 메뉴 닫기 및 스크롤/리사이즈 시 메뉴 닫기
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowUserMenu(false);
        setShowCategoryMenu(false);
      }
    }

    function handleScrollOrResize() {
      setShowUserMenu(false);
      setShowCategoryMenu(false);
    }

    document.addEventListener("keydown", handleEscapeKey);
    window.addEventListener("scroll", handleScrollOrResize);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setAvatarUrl(null);
        setIsAdmin(false);
        setUnreadMessages(0);
        setIsLoading(false);
        return;
      }

      try {
        // 아바타와 관리자 권한 동시에 로드
        const [avatarResult, profileResult, messagesResult] = await Promise.all(
          [
            supabase
              .from("profiles")
              .select("avatar_url")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("to_user_id", user.id)
              .eq("read", false)
              .eq("deleted_by_receiver", false),
          ]
        );

        if (!cancelled) {
          const avatar =
            (avatarResult.data as { avatar_url: string | null })?.avatar_url ??
            null;
          setAvatarUrl(avatar);
          setIsAdmin(profileResult.data?.role === "admin");
          setUnreadMessages(messagesResult.count || 0);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Navbar: Error loading user profile:", error);
        if (!cancelled) {
          setIsAdmin(false);
          setAvatarUrl(null);
          setUnreadMessages(0);
          setIsLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  async function handleSignOut() {
    try {
      await signOut();
      setShowUserMenu(false);
      toast.success("로그아웃되었습니다.");
    } catch (error) {
      console.error("SignOut error:", error);
      toast.error("로그아웃 중 오류가 발생했습니다.");
    }
  }

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
    setShowCategoryMenu(false);
  };

  const toggleCategoryMenu = () => {
    setShowCategoryMenu(!showCategoryMenu);
    setShowUserMenu(false);
  };

  // 드롭다운 위치 계산 함수
  const getDropdownPosition = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || typeof window === "undefined")
      return { top: 0, right: 0 };

    const rect = ref.current.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      width: "12rem",
    };
  };

  return (
    <header className="w-full border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold">
            AI Hub
          </Link>
          <nav className="hidden md:flex items-center gap-3 text-sm">
            <Link href="/categories/free">자유게시판</Link>
            <Link href="/categories/ai-qa">AI 물어보기</Link>
            <Link href="/categories/ai-briefing">AI 브리핑</Link>
            <Link href="/categories/vibe-coding">바이브코딩</Link>
            <Link href="/categories/ai-studio">AI 스튜디오</Link>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          {/* 모바일 카테고리 메뉴 */}
          <div className="md:hidden relative" ref={categoryMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="p-2 h-8 w-8"
              onClick={toggleCategoryMenu}
              aria-label="카테고리 메뉴"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            {showCategoryMenu &&
              mounted &&
              createPortal(
                <div
                  ref={categoryDropdownRef}
                  className="fixed bg-background border rounded-lg shadow-lg z-[9999]"
                  style={getDropdownPosition(categoryMenuRef)}
                >
                  <div className="p-1">
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/categories/${category.slug}`}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                        onClick={() => setShowCategoryMenu(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>,
                document.body
              )}
          </div>

          <ThemeToggle />
          {isLoading ? (
            <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 h-8 w-8"
                  aria-label="관리자 패널"
                  onClick={() => {
                    router.push("/admin-panel");
                  }}
                >
                  <Shield className="h-5 w-5" />
                </Button>
              )}
              <Link
                href="/messages"
                aria-label="쪽지함"
                className="relative p-2 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center"
              >
                <Inbox className="h-5 w-5" />
                {unreadMessages > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                  >
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </Badge>
                )}
              </Link>

              {/* 사용자 메뉴 드롭다운 */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={toggleUserMenu}
                  className="h-8 w-8 rounded-full border overflow-hidden flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="사용자 메뉴"
                  aria-expanded={showUserMenu}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20">
                      <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </button>

                {/* 드롭다운 메뉴 */}
                {showUserMenu &&
                  mounted &&
                  createPortal(
                    <div
                      ref={userDropdownRef}
                      className="fixed bg-background border rounded-lg shadow-lg z-[9999]"
                      style={getDropdownPosition(userMenuRef)}
                    >
                      <div className="p-1">
                        <Link
                          href="/profile/me"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <UserIcon className="h-4 w-4" />내 프로필
                        </Link>
                        <Link
                          href="/settings"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings className="h-4 w-4" />
                          설정
                        </Link>
                        <div className="h-px bg-border my-1" />
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          로그아웃
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              aria-label="로그인 / 회원가입"
              className="p-2 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center"
            >
              <LogIn className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

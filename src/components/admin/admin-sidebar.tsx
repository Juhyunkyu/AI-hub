"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Settings,
  Home,
} from "lucide-react";

const adminNavItems = [
  {
    title: "대시보드",
    href: "/admin-panel",
    icon: LayoutDashboard,
  },
  {
    title: "사용자 관리",
    href: "/admin-panel/users",
    icon: Users,
  },
  {
    title: "게시글 관리",
    href: "/admin-panel/posts",
    icon: FileText,
  },
  {
    title: "댓글 관리",
    href: "/admin-panel/comments",
    icon: MessageSquare,
  },
  {
    title: "사이트 설정",
    href: "/admin-panel/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 min-h-screen bg-muted/50 border-r">
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Home className="h-6 w-6" />
          <span className="font-semibold">관리자 패널</span>
        </div>

        <nav className="space-y-2">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-8 pt-6 border-t">
          <Link
            href="/"
            className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>사이트로 돌아가기</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

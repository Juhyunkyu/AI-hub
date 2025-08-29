"use client";

import Link from "next/link";
import { AdminIcon } from "@/components/admin-icon";
import { ChevronRight, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { X } from "lucide-react";

interface NoticeBannerProps {
  notices: Array<{
    id: string;
    title: string;
    created_at: string;
    author_id: string;
    anonymous: boolean;
  }>;
  variant?: "compact" | "carousel" | "accordion" | "sticky";
  className?: string;
  dismissible?: boolean;
}

export function NoticeBanner({
  notices,
  variant = "compact",
  className,
  dismissible = false,
}: NoticeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!notices.length || dismissed) return null;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 relative",
          className
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              공지사항
            </span>
          </div>
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="space-y-1">
          {notices.slice(0, 2).map((notice, index) => (
            <Link
              key={notice.id}
              href={`/posts/${notice.id}`}
              className="flex items-center justify-between group hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded px-2 py-1 transition-colors"
            >
              <span className="text-sm text-blue-800 dark:text-blue-200 truncate group-hover:underline">
                {notice.title}
              </span>
              <ChevronRight className="h-3 w-3 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
          {notices.length > 2 && (
            <Link
              href="/notice"
              className="flex items-center justify-center text-xs text-blue-600 dark:text-blue-400 hover:underline py-1"
            >
              공지사항 더보기 ({notices.length - 2}개)
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (variant === "carousel") {
    return (
      <div
        className={cn(
          "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Pin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            공지사항
          </span>
        </div>
        <div className="overflow-hidden">
          <div className="flex animate-scroll-x gap-4">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href={`/posts/${notice.id}`}
                className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-md px-3 py-2 border border-blue-200 dark:border-blue-700 hover:shadow-sm transition-shadow min-w-[200px]"
              >
                <div className="text-sm text-blue-800 dark:text-blue-200 truncate">
                  {notice.title}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {new Date(notice.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "accordion") {
    return (
      <div
        className={cn(
          "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg",
          className
        )}
      >
        <details className="group">
          <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                공지사항 ({notices.length}개)
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="px-3 pb-3 space-y-1">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href={`/posts/${notice.id}`}
                className="flex items-center justify-between group hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded px-2 py-1 transition-colors"
              >
                <span className="text-sm text-blue-800 dark:text-blue-200 truncate group-hover:underline">
                  {notice.title}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                  {new Date(notice.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </details>
      </div>
    );
  }

  return null;
}

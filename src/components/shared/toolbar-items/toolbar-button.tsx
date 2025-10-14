"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string; // For aria-label only
  isActive?: boolean;
  variant?: 'default' | 'destructive';
  onClick: () => void;
  className?: string;
}

export function ToolbarButton({
  icon: Icon,
  label,
  isActive = false,
  variant = 'default',
  onClick,
  className
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={label}
      tabIndex={0}
      className={cn(
        "h-10 w-10 rounded-lg transition-all flex-shrink-0",
        "flex items-center justify-center",
        "backdrop-blur-md border border-white/10",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black",
        isActive ? [
          "bg-primary text-primary-foreground",
          "shadow-lg scale-105"
        ] : [
          "bg-black/60 hover:bg-black/80",
          "text-white hover:text-white/90",
          "active:scale-95"
        ],
        variant === 'destructive' && !isActive &&
          "bg-red-500/60 hover:bg-red-600/80",
        className
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}

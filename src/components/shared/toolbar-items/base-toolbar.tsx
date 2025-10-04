"use client";

import { Button } from "@/components/ui/button";
import { Download, Share2, Trash2, Edit3 } from "lucide-react";

interface BaseToolbarProps {
  onDownload: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit: () => void;
}

export function BaseToolbar({
  onDownload,
  onShare,
  onDelete,
  onEdit
}: BaseToolbarProps) {
  const buttons = [
    {
      icon: Download,
      label: "저장",
      onClick: onDownload,
      show: true
    },
    {
      icon: Share2,
      label: "공유",
      onClick: onShare,
      show: !!onShare
    },
    {
      icon: Trash2,
      label: "삭제",
      onClick: onDelete,
      show: !!onDelete,
      variant: "destructive" as const
    },
    {
      icon: Edit3,
      label: "편집",
      onClick: onEdit,
      show: true
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {buttons
        .filter((b) => b.show)
        .map(({ icon: Icon, label, onClick, variant }) => (
          <Button
            key={label}
            variant={variant || "secondary"}
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="flex-col h-16 w-16 gap-1 bg-black/60 hover:bg-black/80 text-white border-none backdrop-blur-md data-[variant=destructive]:bg-red-500/60 data-[variant=destructive]:hover:bg-red-600/80"
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
    </div>
  );
}

"use client";

import { Download, Share2, Trash2, Edit3 } from "lucide-react";
import { ToolbarButton } from './toolbar-button';

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
    <div className="flex items-center gap-3">
      {buttons
        .filter((b) => b.show)
        .map(({ icon, label, onClick, variant }) => (
          <ToolbarButton
            key={label}
            icon={icon}
            label={label}
            variant={variant}
            onClick={onClick!}
          />
        ))}
    </div>
  );
}

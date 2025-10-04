"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/date-utils";

interface LightboxHeaderProps {
  senderName: string;
  senderAvatar?: string | null;
  sentAt: string | Date;
  visible: boolean;
}

export function LightboxHeader({
  senderName,
  senderAvatar,
  sentAt,
  visible
}: LightboxHeaderProps) {
  if (!visible) return null;

  const timeAgo = formatTimeAgo(sentAt);

  // 이름에서 첫 글자 추출 (fallback용)
  const fallbackText = senderName?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="absolute top-4 left-4 z-20">
      <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg">
        <Avatar className="h-10 w-10">
          <AvatarImage src={senderAvatar || undefined} alt={senderName} />
          <AvatarFallback>{fallbackText}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">{senderName}</span>
          <span className="text-xs text-white/70">{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { AvatarUpload } from "./avatar-upload";

interface AvatarWithEditProps {
  avatarUrl?: string | null;
  username?: string | null;
  isOwner?: boolean;
}

export function AvatarWithEdit({
  avatarUrl,
  username,
  isOwner = false,
}: AvatarWithEditProps) {
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);

  return (
    <div className="relative">
      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border bg-muted overflow-hidden">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={username ?? "avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {username?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
        )}
      </div>

      {isOwner && (
        <button
          onClick={() => setShowAvatarUpload(true)}
          className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
          title="프로필 사진 변경"
        >
          <Camera className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      {showAvatarUpload && (
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          onClose={() => setShowAvatarUpload(false)}
          onSuccess={(newUrl) => {
            // 아바타 업데이트 후 페이지 새로고침
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

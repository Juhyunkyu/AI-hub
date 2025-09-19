"use client";

import { useState } from "react";
import { User, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";

interface UserAvatarProps {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
  showActions?: boolean;
  isOwner?: boolean;
  showName?: boolean; // 닉네임 표시 여부
  showFollowButton?: boolean; // 팔로우 버튼 표시 여부
  secondaryText?: React.ReactNode; // 이름 아래 보조 텍스트(예: 날짜/시간)
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10 sm:h-12 sm:w-12",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function UserAvatar({
  userId,
  username,
  avatarUrl,
  size = "md",
  showActions = true,
  isOwner = false,
  showName = false,
  showFollowButton = false,
  secondaryText,
}: UserAvatarProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const handleAvatarClick = () => {
    if (isOwner) {
      setShowAvatarUpload(true);
    }
    // 비소유자는 이미지 클릭 시 아무 동작 없음 (이름에서 메뉴 사용)
  };

  const handleNameClick = () => {
    if (!username) return;

    // 비로그인 사용자는 메뉴를 표시하지 않고 로그인 페이지로 이동
    if (!user) {
      const next = `/profile/${encodeURIComponent(username)}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (showActions) setShowActionsMenu((v) => !v);
  };

  const handleMessageClick = async () => {
    if (!user) {
      const next = `/chat`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setShowActionsMenu(false);

    try {
      console.log('Current user:', user);
      console.log('Target user:', { userId, username });

      // 본인에게 DM을 보내는 경우 특별 처리
      if (user.id === userId) {
        console.log('Self chat requested');

        // 본인과의 채팅방 생성/조회 (API에서 기존방 확인 후 처리)
        const createResponse = await fetch('/api/chat/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'self',
            participant_ids: [userId]
          })
        });

        console.log('Self chat API response status:', createResponse.status);

        if (createResponse.ok) {
          const responseData = await createResponse.json();
          console.log('Self chat API response data:', responseData);
          const { room } = responseData;

          if (!room || !room.id) {
            throw new Error('채팅방 정보를 받지 못했습니다');
          }

          console.log('Self chat room:', room);
          router.push(`/chat?room=${room.id}`);
          toast.success('나에게 쓰기를 시작했습니다');
          return;
        } else {
          const errorText = await createResponse.text();
          console.error('Self chat API error status:', createResponse.status);
          console.error('Self chat API error response:', errorText);

          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || 'Unknown error' };
          }

          throw new Error(errorData.error || `API Error: ${createResponse.status}`);
        }
      }

      // 다른 사용자와의 채팅방 처리
      const response = await fetch(`/api/chat/users?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        const targetUser = data.users[0];

        if (targetUser?.has_chat && targetUser?.chat_room_id) {
          // 기존 채팅방으로 이동
          router.push(`/chat?room=${targetUser.chat_room_id}`);
          return;
        }
      }

      // 새 채팅방 생성
      console.log('Creating new chat room with user:', { userId, username });

      const createResponse = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          participant_ids: [userId]
        })
      });

      console.log('Create response status:', createResponse.status);
      console.log('Create response headers:', Object.fromEntries(createResponse.headers.entries()));

      if (createResponse.ok) {
        const responseData = await createResponse.json();
        console.log('Create response data:', responseData);
        const { room } = responseData;
        
        if (!room || !room.id) {
          throw new Error('채팅방 정보를 받지 못했습니다');
        }
        
        console.log('Created room:', room);
        // Next.js router로 부드럽게 이동
        router.push(`/chat?room=${room.id}`);
        toast.success('채팅을 시작했습니다');
      } else {
        const errorData = await createResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Create room error:', errorData);
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || '채팅방 생성 실패';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(`채팅을 시작할 수 없습니다: ${errorMessage}`);
    }
  };

  const handleProfileClick = () => {
    if (!username) {
      toast.error("이 사용자의 프로필을 볼 수 없습니다");
      setShowActionsMenu(false);
      return;
    }
    if (!user) {
      const next = `/profile/${encodeURIComponent(username)}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
    } else {
      router.push(`/profile/${encodeURIComponent(username)}`);
    }
    setShowActionsMenu(false);
  };

  const handleFollowClick = async () => {
    if (isOwner) return;

    setFollowLoading(true);
    try {
      // TODO: 팔로우/언팔로우 API 호출
      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? "언팔로우했습니다" : "팔로우했습니다");
    } catch {
      toast.error("팔로우 처리 중 오류가 발생했습니다");
    } finally {
      setFollowLoading(false);
    }
  };

  const AvatarComponent = (
    <div
      onClick={handleAvatarClick}
      className={`${sizeClasses[size]} rounded-full border bg-muted overflow-hidden flex items-center justify-center ${
        isOwner
          ? "cursor-pointer hover:opacity-80 transition-opacity"
          : "cursor-default"
      }`}
      title={isOwner ? "프로필 사진 변경" : username || "사용자"}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={username ?? "avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20">
          {username ? (
            <span
              className={`font-bold text-blue-600 dark:text-blue-400 ${
                size === "sm"
                  ? "text-xs"
                  : size === "md"
                    ? "text-sm"
                    : "text-lg"
              }`}
            >
              {username.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User
              className={`text-blue-600 dark:text-blue-400 ${iconSizes[size]}`}
            />
          )}
        </div>
      )}
    </div>
  );

  // 닉네임과 함께 표시하는 경우 (아바타 왼쪽, 오른쪽에 이름/보조텍스트 수직 정렬)
  if (showName) {
    const displayName = username || "익명";
    const isAnonymous = !username;

    return (
      <div className="relative">
        <div className="flex items-center gap-2 group">
          {AvatarComponent}
          <div className="leading-tight">
            <span
              onClick={isAnonymous ? undefined : handleNameClick}
              className={`text-[13px] sm:text-sm font-medium ${
                isAnonymous
                  ? "cursor-default text-muted-foreground"
                  : "hover:underline cursor-pointer group-hover:text-primary transition-colors"
              }`}
            >
              {displayName}
            </span>
            {secondaryText ? (
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {secondaryText}
              </div>
            ) : null}
          </div>
          {showFollowButton && !isOwner && !isAnonymous && (
            <Button
              size="sm"
              variant={isFollowing ? "outline" : "default"}
              onClick={handleFollowClick}
              disabled={followLoading}
              className="h-6 px-2 text-xs"
            >
              {followLoading ? "..." : isFollowing ? "언팔로우" : "팔로우"}
            </Button>
          )}
        </div>

        {/* 액션 메뉴 (로그인된 사용자, 익명이 아닐 때만 표시) */}
        {showActionsMenu && showActions && !isOwner && !isAnonymous && user && (
          <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg z-50 min-w-[120px]">
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleProfileClick}
                className="w-full justify-start text-xs"
              >
                <FileText className={`${iconSizes.sm} mr-2`} />
                프로필 보기
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMessageClick}
                className="w-full justify-start text-xs"
              >
                <MessageSquare className={`${iconSizes.sm} mr-2`} />
                {isOwner ? "나에게 쓰기" : "DM 보내기"}
              </Button>
            </div>
          </div>
        )}

        {/* 아바타 업로드 모달 */}
        {showAvatarUpload && (
          <AvatarUpload
            currentAvatarUrl={avatarUrl}
            onClose={() => setShowAvatarUpload(false)}
            onSuccess={(newUrl) => {
              window.location.reload();
            }}
          />
        )}

        {/* 배경 오버레이 (메뉴 닫기용) */}
        {showActionsMenu && !isAnonymous && user && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowActionsMenu(false)}
          />
        )}
      </div>
    );
  }

  // 기존 아바타만 표시하는 경우
  return (
    <div className="relative">
      {AvatarComponent}

      {/* 액션 메뉴 */}
      {showActionsMenu && showActions && !isOwner && (
        <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg z-50 min-w-[120px]">
          <div className="p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleProfileClick}
              className="w-full justify-start text-xs"
            >
              <FileText className={`${iconSizes.sm} mr-2`} />
              프로필 보기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMessageClick}
              className="w-full justify-start text-xs"
            >
              <MessageSquare className={`${iconSizes.sm} mr-2`} />
              {isOwner ? "나에게 쓰기" : "DM 보내기"}
            </Button>
          </div>
        </div>
      )}

      {/* 아바타 업로드 모달 */}
      {showAvatarUpload && (
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          onClose={() => setShowAvatarUpload(false)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}

      {/* 배경 오버레이 (메뉴 닫기용) */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionsMenu(false)}
        />
      )}
    </div>
  );
}

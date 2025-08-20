"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvatarWithEdit } from "@/components/profile/avatar-with-edit";
import { ProfileMeta } from "@/components/profile/profile-meta";
import { Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

interface ProfileHeaderProps {
  userId: string;
  initialUsername: string | null;
  initialBio: string | null;
  avatarUrl: string | null;
}

export function ProfileHeader({
  userId,
  initialUsername,
  initialBio,
  avatarUrl,
}: ProfileHeaderProps) {
  const supabase = createSupabaseBrowserClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.id === userId;

  const [username, setUsername] = useState(initialUsername || "");
  const [bio, setBio] = useState(initialBio || "");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 편집 모드 시작 시 포커스
  useEffect(() => {
    if (isEditingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
      usernameInputRef.current.select();
    }
  }, [isEditingUsername]);

  useEffect(() => {
    if (isEditingBio && bioTextareaRef.current) {
      bioTextareaRef.current.focus();
    }
  }, [isEditingBio]);

  const handleSaveUsername = async () => {
    if (!username.trim()) {
      toast.error("사용자 이름은 필수입니다");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, username: username.trim() });

    setIsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("사용자 이름이 저장되었습니다");
    setIsEditingUsername(false);
  };

  const handleSaveBio = async () => {
    setIsLoading(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, bio: bio.trim() });

    setIsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("소개글이 저장되었습니다");
    setIsEditingBio(false);
  };

  const handleCancelUsername = () => {
    setUsername(initialUsername || "");
    setIsEditingUsername(false);
  };

  const handleCancelBio = () => {
    setBio(initialBio || "");
    setIsEditingBio(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "username" | "bio") => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (type === "username") {
        handleSaveUsername();
      }
    } else if (e.key === "Escape") {
      if (type === "username") {
        handleCancelUsername();
      } else {
        handleCancelBio();
      }
    }
  };

  const shouldShowMoreButton = bio && bio.length > 80;
  const displayBio = showFullBio ? bio : bio?.slice(0, 80);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <AvatarWithEdit
          avatarUrl={avatarUrl}
          username={username}
          isOwner={isOwner}
        />
        <div className="space-y-2">
          {/* 사용자명 편집 */}
          <div className="flex items-center gap-2">
            {isEditingUsername ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={usernameInputRef}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, "username")}
                  className="w-48"
                  placeholder="사용자 이름"
                />
                <Button
                  size="sm"
                  onClick={handleSaveUsername}
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelUsername}
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {username || "사용자"}
                </h1>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingUsername(true)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <ProfileMeta userId={userId} badges={["member"]} />

          {/* 소개글 편집 */}
          <div className="space-y-1">
            {isEditingBio ? (
              <div className="space-y-2">
                <Textarea
                  ref={bioTextareaRef}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, "bio")}
                  placeholder="자신을 소개해주세요..."
                  rows={3}
                  className="max-w-md"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveBio}
                    disabled={isLoading}
                  >
                    저장
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelBio}
                    disabled={isLoading}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group">
                {bio ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-start gap-1">
                      <span className="text-sm text-muted-foreground">
                        {showFullBio ? bio : displayBio}
                        {shouldShowMoreButton && !showFullBio && (
                          <>
                            ...
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowFullBio(true)}
                              className="inline-flex h-auto p-0 text-muted-foreground hover:text-foreground ml-1"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {shouldShowMoreButton && showFullBio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowFullBio(false)}
                            className="inline-flex h-auto p-0 text-muted-foreground hover:text-foreground ml-1"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        )}
                      </span>
                    </div>
                    {isOwner && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditingBio(true)}
                          className="h-5 px-1.5 text-xs bg-background/95 backdrop-blur-sm border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors shadow-sm"
                        >
                          <Pencil className="h-2.5 w-2.5 mr-1" />
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground italic">
                      소개글이 없습니다
                    </p>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingBio(true)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

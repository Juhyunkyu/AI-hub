"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, X } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useRouter } from "next/navigation";

type FollowUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function ProfileMeta({
  userId,
  badges,
}: {
  userId: string;
  badges?: string[];
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ count: f1 }, { count: f2 }] = await Promise.all([
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", userId),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", userId),
      ]);
      setFollowers(f1 ?? 0);
      setFollowing(f2 ?? 0);
    }
    load();
  }, [supabase, userId]);

  const loadFollowers = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/follows?targetUserId=${userId}&type=followers`
      );
      if (response.ok) {
        const { data } = await response.json();
        setFollowersList(
          data.map((item: { profile: FollowUser }) => item.profile)
        );
      }
    } catch (error) {
      console.error("Failed to load followers:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowing = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/follows?targetUserId=${userId}&type=following`
      );
      if (response.ok) {
        const { data } = await response.json();
        setFollowingList(
          data.map((item: { profile: FollowUser }) => item.profile)
        );
      }
    } catch (error) {
      console.error("Failed to load following:", error);
    } finally {
      setLoading(false);
    }
  };

  const FollowModal = ({
    isOpen,
    onClose,
    title,
    users,
    loading,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    users: FollowUser[];
    loading: boolean;
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                    <div className="h-4 bg-muted animate-pulse rounded flex-1" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {title === "팔로워"
                  ? "팔로워가 없습니다"
                  : "팔로우한 사용자가 없습니다"}
              </p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer transition-colors"
                    onClick={() => {
                      if (user.username) {
                        onClose(); // 모달 닫기
                        router.push(
                          `/profile/${encodeURIComponent(user.username)}`
                        );
                      }
                    }}
                  >
                    <UserAvatar
                      userId={user.id}
                      username={user.username}
                      avatarUrl={user.avatar_url}
                      size="sm"
                      showActions={false}
                      isOwner={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.username}</p>
                      {user.bio && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <button
          onClick={() => {
            setShowFollowers(true);
            loadFollowers();
          }}
          className="hover:text-foreground transition-colors cursor-pointer"
        >
          팔로워 {followers}
        </button>
        <button
          onClick={() => {
            setShowFollowing(true);
            loadFollowing();
          }}
          className="hover:text-foreground transition-colors cursor-pointer"
        >
          팔로잉 {following}
        </button>
        {badges && badges.length > 0 && (
          <div className="flex items-center gap-1">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-full border px-2 py-0.5 bg-background text-foreground"
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <FollowModal
        isOpen={showFollowers}
        onClose={() => setShowFollowers(false)}
        title="팔로워"
        users={followersList}
        loading={loading}
      />

      <FollowModal
        isOpen={showFollowing}
        onClose={() => setShowFollowing(false)}
        title="팔로잉"
        users={followingList}
        loading={loading}
      />
    </>
  );
}

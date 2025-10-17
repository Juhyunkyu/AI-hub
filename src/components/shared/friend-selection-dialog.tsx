"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Friend {
  id: string;
  username: string;
  bio?: string;
  avatar_url?: string;
}

interface FriendSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedFriendIds: string[]) => void | Promise<void>;
}

export function FriendSelectionDialog({
  isOpen,
  onClose,
  onConfirm,
}: FriendSelectionDialogProps) {
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch following friends
  const { data: friendsData, isLoading, error } = useQuery<{ users: Friend[] }>({
    queryKey: ["/api/users/following"],
    queryFn: async () => {
      const res = await fetch("/api/users/following");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    enabled: isOpen,
  });

  const friends = useMemo(() => friendsData?.users || [], [friendsData]);

  // 검색 필터링
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase();
    return friends.filter(friend =>
      friend.username.toLowerCase().includes(query)
    );
  }, [friends, searchQuery]);

  // Toggle friend selection
  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  // Handle confirm
  const handleConfirm = async () => {
    if (selectedFriendIds.size === 0) return;

    setIsConfirming(true);
    try {
      await onConfirm(Array.from(selectedFriendIds));
      setSelectedFriendIds(new Set());
      onClose();
    } catch (error) {
      console.error("Error confirming friend selection:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (!isConfirming) {
      setSelectedFriendIds(new Set());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>친구 선택</DialogTitle>
          <DialogDescription>
            이미지를 공유할 친구를 선택하세요 (여러 명 선택 가능)
          </DialogDescription>
        </DialogHeader>

        {/* 검색 입력 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="친구 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              친구 목록을 불러오는데 실패했습니다
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              팔로우하는 친구가 없습니다
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.has(friend.id);
                return (
                  <div
                    key={friend.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    )}
                    onClick={() => toggleFriend(friend.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleFriend(friend.id)}
                      className="pointer-events-none"
                    />

                    <Avatar className="h-10 w-10">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.username}
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{friend.username}</p>
                    </div>

                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedFriendIds.size}명 선택됨
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isConfirming}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedFriendIds.size === 0 || isConfirming}
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  전송 중...
                </>
              ) : (
                `공유 (${selectedFriendIds.size})`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

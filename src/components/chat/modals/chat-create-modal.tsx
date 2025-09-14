"use client";

import { useState, useCallback, useEffect, memo, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, Check } from "lucide-react";
import { getFollowingUsers, type User } from "@/lib/chat-api";

interface ChatCreateModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated?: (roomId: string) => void;
}

// 개별 팔로우 사용자 아이템 컴포넌트 (React.memo로 최적화)
const FollowUserItem = memo(function FollowUserItem({
  user,
  isSelected,
  onToggle
}: {
  user: User;
  isSelected: boolean;
  onToggle: (userId: string) => void;
}) {
  const handleClick = useCallback(() => onToggle(user.id), [onToggle, user.id]);

  return (
    <div
      className="flex items-center gap-3 p-4 hover:bg-muted cursor-pointer"
      onClick={handleClick}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={user.avatar_url} alt={user.username} />
        <AvatarFallback>
          {user.username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.username}</p>
        {user.bio && (
          <p className="text-sm text-muted-foreground truncate">
            {user.bio}
          </p>
        )}
      </div>

      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(user.id)}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0"
      />
    </div>
  );
});

export const ChatCreateModal = memo(function ChatCreateModal({ open, onClose, onChatCreated }: ChatCreateModalProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set<string>());
  const [loading, setLoading] = useState(false);

  // 검색 필터링을 useMemo로 최적화
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return followingUsers;
    }
    return followingUsers.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [followingUsers, searchQuery]);

  // 팔로우한 사용자 목록 로드
  const loadFollowingUsers = useCallback(async () => {
    try {
      setLoading(true);

      const result = await getFollowingUsers();

      if (result.error) {
        console.error("Failed to load following users:", result.error);
        setFollowingUsers([]);
        return;
      }

      setFollowingUsers(result.users);
    } catch (error) {
      console.error("Failed to load following users:", error);
      setFollowingUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // open prop 변경을 감지하여 팔로우 사용자 로드
  useEffect(() => {
    if (open) {
      loadFollowingUsers();
    }
  }, [open, loadFollowingUsers]);

  // 사용자 선택/해제
  const handleUserToggle = useCallback((userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  }, [selectedUsers]);

  // 채팅방 생성 확인
  const handleConfirm = useCallback(async () => {
    if (selectedUsers.size === 0) return;

    try {
      setLoading(true);

      const participantIds = Array.from(selectedUsers);

      // 1:1 채팅방인 경우 createDirectChatRoom 사용
      if (participantIds.length === 1) {
        const { createDirectChatRoom } = await import('@/lib/chat-api');
        const result = await createDirectChatRoom(participantIds[0]);

        if (result.success && result.roomId) {
          onChatCreated?.(result.roomId);
          onClose();
          // 상태 초기화
          setSelectedUsers(new Set());
          setSearchQuery("");
        } else {
          console.error("Failed to create direct chat:", result.error);
        }
      } else {
        // 그룹 채팅방 생성은 나중에 구현
        console.log("Group chat creation not implemented yet");

        // 임시로 첫 번째 사용자와 1:1 채팅 생성
        const { createDirectChatRoom } = await import('@/lib/chat-api');
        const result = await createDirectChatRoom(participantIds[0]);

        if (result.success && result.roomId) {
          onChatCreated?.(result.roomId);
          onClose();
          // 상태 초기화
          setSelectedUsers(new Set());
          setSearchQuery("");
        } else {
          console.error("Failed to create chat:", result.error);
        }
      }
    } catch (error) {
      console.error("Failed to create chat room:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedUsers, onChatCreated, onClose]);

  // 모달이 닫힐 때 상태 초기화
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
      // 상태 초기화
      setSelectedUsers(new Set());
      setSearchQuery("");
    }
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md h-[600px] max-h-[80vh] p-0 overflow-hidden flex flex-col">
        {/* 헤더 - 팔로우 제목만 (모달 자체 X 사용) */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="text-lg font-semibold text-center">팔로우</DialogTitle>
          <DialogDescription className="sr-only">
            팔로우한 사용자 목록에서 선택하여 채팅방을 생성할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 검색창 + 확인 버튼 */}
        <div className="px-4 py-3 flex-shrink-0 border-b">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="팔로우 사용자 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedUsers.size === 0 || loading}
              title="확인"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 팔로우 사용자 목록 - 나머지 공간을 모두 차지 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-muted-foreground">
              로딩 중...
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다." : "팔로우한 사용자가 없습니다."}
            </div>
          )}

          {!loading && filteredUsers.map((user) => (
            <FollowUserItem
              key={user.id}
              user={user}
              isSelected={selectedUsers.has(user.id)}
              onToggle={handleUserToggle}
            />
          ))}
        </div>

        {/* 선택된 사용자 수 표시 */}
        {selectedUsers.size > 0 && (
          <div className="p-3 border-t bg-muted/50 text-center text-sm text-muted-foreground">
            {selectedUsers.size}명 선택됨
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
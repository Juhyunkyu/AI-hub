"use client";

import { useState, useCallback, useEffect, memo, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X, UserPlus, MessageCircle, UserMinus, Loader2 } from "lucide-react";
import { searchUsers, toggleFollow, createDirectChatRoom, type User } from "@/lib/chat-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface UserSearchModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated?: (roomId: string) => void;
}

interface UserWithFollowState extends User {
  isFollowing?: boolean;
  followLoading?: boolean;
}

// 개별 사용자 아이템 컴포넌트 (React.memo로 최적화)
const UserSearchItem = memo(function UserSearchItem({
  user,
  onFollow,
  onStartChat,
  loading
}: {
  user: UserWithFollowState;
  onFollow: (userId: string) => void;
  onStartChat: (userId: string) => void;
  loading: boolean;
}) {
  const handleFollowClick = useCallback(() => onFollow(user.id), [onFollow, user.id]);
  const handleChatClick = useCallback(() => onStartChat(user.id), [onStartChat, user.id]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted border-b border-border/50 last:border-b-0">
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

      <div className="flex gap-2 flex-shrink-0">
        <Button
          variant={user.isFollowing ? "default" : "outline"}
          size="sm"
          onClick={handleFollowClick}
          disabled={user.followLoading}
          title={user.isFollowing ? "언팔로우" : "팔로우"}
        >
          {user.followLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : user.isFollowing ? (
            <UserMinus className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleChatClick}
          title="채팅 시작"
          disabled={loading}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export const UserSearchModal = memo(function UserSearchModal({ open, onClose, onChatCreated }: UserSearchModalProps) {
  const supabase = createSupabaseBrowserClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserWithFollowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string, page = 0, append = false) => {
    if (query.length < 2) {
      setSearchResults([]);
      setHasMore(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await searchUsers(query, page);

      if (result.error) {
        setError(result.error);
        return;
      }

      // 각 사용자의 팔로우 상태 확인
      const currentUser = (await supabase.auth.getUser()).data.user;
      let usersWithFollowState: UserWithFollowState[] = [];

      if (currentUser) {
        // 모든 사용자에 대한 팔로우 상태를 한 번에 조회
        const userIds = result.users.map(u => u.id);
        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id)
          .in('following_id', userIds);

        const followingIds = new Set(followData?.map(f => f.following_id) || []);

        usersWithFollowState = result.users.map(user => ({
          ...user,
          isFollowing: followingIds.has(user.id),
          followLoading: false
        }));
      } else {
        usersWithFollowState = result.users.map(user => ({
          ...user,
          isFollowing: false,
          followLoading: false
        }));
      }

      if (append) {
        setSearchResults(prev => [...prev, ...usersWithFollowState]);
      } else {
        setSearchResults(usersWithFollowState);
      }

      setHasMore(result.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error("Search error:", error);
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFollow = useCallback(async (userId: string) => {
    // 로딩 상태 설정
    setSearchResults(prev => prev.map(user =>
      user.id === userId ? { ...user, followLoading: true } : user
    ));

    try {
      const result = await toggleFollow(userId);

      if (result.success) {
        // 팔로우 상태 업데이트
        setSearchResults(prev => prev.map(user =>
          user.id === userId
            ? { ...user, isFollowing: result.isFollowing, followLoading: false }
            : user
        ));
      } else {
        console.error("Follow error:", result.error);
        setError(result.error || "팔로우 처리 중 오류가 발생했습니다.");
        // 로딩 상태 해제
        setSearchResults(prev => prev.map(user =>
          user.id === userId ? { ...user, followLoading: false } : user
        ));
      }
    } catch (error) {
      console.error("Follow error:", error);
      setError("팔로우 처리 중 오류가 발생했습니다.");
      // 로딩 상태 해제
      setSearchResults(prev => prev.map(user =>
        user.id === userId ? { ...user, followLoading: false } : user
      ));
    }
  }, []);

  const handleStartChat = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const result = await createDirectChatRoom(userId);

      if (result.success && result.roomId) {
        onChatCreated?.(result.roomId);
        onClose();
      } else {
        console.error("Chat creation error:", result.error);
        setError(result.error || "채팅방 생성 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("Chat creation error:", error);
      setError("채팅방 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [onChatCreated, onClose]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading && searchQuery.length >= 2) {
      handleSearch(searchQuery, currentPage + 1, true);
    }
  }, [hasMore, loading, searchQuery, currentPage, handleSearch]);

  // 검색어 변경 시 디바운싱
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSearchResults([]);
      setError(null);
      setHasMore(false);
      setCurrentPage(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md h-[600px] max-h-[80vh] p-0 overflow-hidden flex flex-col">
        {/* 헤더 - 사람 찾기 제목만 (모달 자체 X 사용) */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="text-lg font-semibold text-center">사람 찾기</DialogTitle>
          <DialogDescription className="sr-only">
            사용자를 검색하여 팔로우하거나 채팅을 시작할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 검색창 */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="사용자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 검색 결과 - 나머지 공간을 모두 차지 */}
        <div className="flex-1 overflow-y-auto border-t">
          {error && (
            <div className="p-4 text-center text-red-600 bg-red-50 border-b">
              {error}
            </div>
          )}

          {loading && searchResults.length === 0 && (
            <div className="px-4 py-3 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              검색 중...
            </div>
          )}

          {!loading && searchQuery.length >= 2 && searchResults.length === 0 && !error && (
            <div className="px-4 py-6 text-center text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}

          {searchResults.map((user) => (
            <UserSearchItem
              key={user.id}
              user={user}
              onFollow={handleFollow}
              onStartChat={handleStartChat}
              loading={loading}
            />
          ))}

          {/* 더 보기 버튼 */}
          {hasMore && !loading && (
            <div className="px-4 py-3 text-center border-t">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full"
              >
                더 보기
              </Button>
            </div>
          )}

          {/* 무한 스크롤 로딩 */}
          {loading && searchResults.length > 0 && (
            <div className="px-4 py-3 text-center text-muted-foreground flex items-center justify-center gap-2 border-t">
              <Loader2 className="h-4 w-4 animate-spin" />
              더 불러오는 중...
            </div>
          )}

          {searchQuery.length < 2 && !error && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <div className="mb-2">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
              </div>
              <div className="text-sm">
                2글자 이상 입력해주세요
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
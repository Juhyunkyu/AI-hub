"use client";
"use memo";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  is_following?: boolean;
  is_follower?: boolean;
}

interface CreateChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "invite";
  roomId?: string;
  excludeUserIds?: string[]; // 이미 참여 중인 사용자 ID 목록
}

export function CreateChatModal({
  open,
  onOpenChange,
  mode = "create",
  roomId,
  excludeUserIds = []
}: CreateChatModalProps) {
  const [chatName, setChatName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("following");

  // 팔로우하는 사용자들 가져오기
  const fetchFollowingUsers = async () => {
    try {
      const response = await fetch("/api/users/following");
      if (response.ok) {
        const data = await response.json();
        // 이미 참여 중인 사용자 필터링
        const filteredUsers = (data.users || []).filter(
          (user: User) => !excludeUserIds.includes(user.id)
        );
        setFollowingUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error fetching following users:", error);
    }
  };

  // 사용자 검색
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/search/users?q=${encodeURIComponent(query)}&includeFollows=true`);
      if (response.ok) {
        const data = await response.json();
        // 이미 참여 중인 사용자 필터링
        const filteredUsers = (data.users || []).filter(
          (user: User) => !excludeUserIds.includes(user.id)
        );
        setSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  // 모달이 열릴 때 팔로우하는 사용자들 가져오기
  useEffect(() => {
    if (open) {
      fetchFollowingUsers();
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUsers([]);
      setActiveTab("following");
      setChatName("");
    } else {
      // 모달이 닫힐 때 상태 초기화
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUsers([]);
      setChatName("");
      setLoading(false);
    }
  }, [open, excludeUserIds]);

  // 사용자 선택/해제
  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // 선택된 사용자 정보 가져오기
  const getSelectedUserInfo = (userId: string): User | undefined => {
    return [...followingUsers, ...searchResults].find(user => user.id === userId);
  };

  const handleCreateChat = async () => {
    if (mode === "invite") {
      // 초대 모드
      if (selectedUsers.length === 0) {
        toast.error("초대할 사용자를 선택해주세요");
        return;
      }

      setLoading(true);
      console.log("📤 Sending invite request:", {
        roomId,
        user_ids: selectedUsers,
        count: selectedUsers.length
      });

      try {
        const response = await fetch(`/api/chat/rooms/${roomId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_ids: selectedUsers }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("✅ Invite successful:", result);
          toast.success(`${selectedUsers.length}명을 초대했습니다`);
          onOpenChange(false);
          // 페이지 새로고침으로 업데이트된 참여자 목록 반영
          window.location.reload();
        } else {
          const error = await response.json();
          console.error("❌ Invite failed:", {
            status: response.status,
            error,
            sentData: { user_ids: selectedUsers, roomId }
          });
          toast.error(error.error || "초대에 실패했습니다");
        }
      } catch (error) {
        console.error("❌ Invite error:", error);
        toast.error("초대에 실패했습니다");
      } finally {
        setLoading(false);
      }
    } else {
      // 생성 모드
      if (selectedUsers.length === 0) {
        toast.error("채팅할 사용자를 선택해주세요");
        return;
      }

      // 1:1 채팅인 경우 채팅방 이름이 필요하지 않음
      if (selectedUsers.length > 1 && !chatName.trim()) {
        toast.error("그룹 채팅방 이름을 입력해주세요");
        return;
      }

      setLoading(true);
      try {
        const chatType = selectedUsers.length === 1 ? "direct" : "group";
        const chatRoomName = chatType === "direct" ? null : chatName.trim();

        const response = await fetch("/api/chat/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: chatRoomName,
            type: chatType,
            participant_ids: selectedUsers,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          toast.success(
            chatType === "direct" 
              ? "1:1 채팅방이 생성되었습니다" 
              : "그룹 채팅방이 생성되었습니다"
          );
          onOpenChange(false);
          
          // 생성된 채팅방으로 이동
          if (data.room?.id) {
            window.location.href = `/chat/${data.room.id}`;
          } else {
            // 페이지 새로고침으로 새 채팅방 목록 반영
            window.location.reload();
          }
        } else {
          const error = await response.json();
          toast.error(error.error || "채팅방 생성에 실패했습니다");
        }
      } catch (error) {
        console.error("Error creating chat:", error);
        toast.error("채팅방 생성에 실패했습니다");
      } finally {
        setLoading(false);
      }
    }
  };

  // 사용자 카드 컴포넌트
  const UserCard = ({ user, showRelationBadge = true }: { user: User; showRelationBadge?: boolean }) => (
    <div
      onClick={() => toggleUser(user.id)}
      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
        selectedUsers.includes(user.id) ? "bg-muted border-2 border-primary/20" : "border-2 border-transparent"
      }`}
    >
      <input
        type="checkbox"
        checked={selectedUsers.includes(user.id)}
        onChange={() => toggleUser(user.id)}
        className="rounded"
      />
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.avatar_url} />
        <AvatarFallback>
          {user.username?.charAt(0)?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{user.username}</p>
          {showRelationBadge && user.is_following && (
            <Badge variant="secondary" className="text-xs">팔로잉</Badge>
          )}
          {showRelationBadge && user.is_follower && !user.is_following && (
            <Badge variant="outline" className="text-xs">팔로워</Badge>
          )}
        </div>
        {user.bio && (
          <p className="text-sm text-muted-foreground truncate">{user.bio}</p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "invite" ? (
              <>
                <UserPlus className="h-5 w-5" />
                사용자 초대
              </>
            ) : (
              <>
                <Users className="h-5 w-5" />
                새 채팅방 만들기
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "invite"
              ? "채팅방에 초대할 사용자를 선택하세요"
              : "새로운 채팅방을 만들 사용자를 선택하세요"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          {mode === "create" && selectedUsers.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="chatName">그룹 채팅방 이름</Label>
              <Input
                id="chatName"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="그룹 채팅방 이름을 입력하세요"
              />
            </div>
          )}

          {mode === "create" && selectedUsers.length === 1 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                1:1 채팅방이 생성됩니다. 채팅방 이름은 자동으로 설정됩니다.
              </p>
            </div>
          )}

          {/* 선택된 사용자들 */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                선택된 사용자 
                <Badge variant="secondary">{selectedUsers.length}명</Badge>
              </Label>
              <ScrollArea className="max-h-20">
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((userId) => {
                    const selectedUser = getSelectedUserInfo(userId);
                    return (
                      <div
                        key={userId}
                        className="flex items-center space-x-2 bg-primary/10 px-3 py-1 rounded-full"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={selectedUser?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {selectedUser?.username?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{selectedUser?.username}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleUser(userId);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 사용자 선택 탭 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="following" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                팔로잉 ({followingUsers.length})
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                검색
              </TabsTrigger>
            </TabsList>

            <TabsContent value="following" className="flex-1 flex flex-col min-h-0 mt-4">
              {followingUsers.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {followingUsers.map((user) => (
                      <UserCard key={user.id} user={user} showRelationBadge={false} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>팔로우하는 사용자가 없습니다</p>
                    <p className="text-sm">검색 탭에서 사용자를 찾아보세요</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="search" className="flex-1 flex flex-col min-h-0 mt-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="사용자 이름으로 검색하세요"
                    className="pl-10"
                  />
                </div>

                {searchQuery.trim() ? (
                  searchResults.length > 0 ? (
                    <ScrollArea className="flex-1">
                      <div className="space-y-2">
                        {searchResults.map((user) => (
                          <UserCard key={user.id} user={user} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                      <div>
                        <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>검색 결과가 없습니다</p>
                        <p className="text-sm">다른 키워드로 검색해보세요</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                    <div>
                      <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>사용자를 검색해보세요</p>
                      <p className="text-sm">이름이나 소개글로 검색할 수 있습니다</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button 
              onClick={handleCreateChat} 
              disabled={
                loading || 
                selectedUsers.length === 0 || 
                (mode === "create" && selectedUsers.length > 1 && !chatName.trim())
              }
            >
              {loading ? (
                mode === "invite" ? "초대 중..." : "생성 중..."
              ) : mode === "invite" ? (
                selectedUsers.length > 0 ? `${selectedUsers.length}명 초대하기` : "초대하기"
              ) : selectedUsers.length === 1 ? (
                "1:1 채팅 시작하기"
              ) : selectedUsers.length > 1 ? (
                "그룹 채팅방 만들기"
              ) : (
                "채팅방 만들기"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



















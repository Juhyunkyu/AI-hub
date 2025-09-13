"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, UserMinus, Crown, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth";
import { CreateChatModal } from "./create-chat-modal";

// Service Worker cache invalidation type
declare global {
  interface Window {
    invalidateChatCache?: (pattern: string) => void;
  }
}

interface Participant {
  id: string;
  user_id: string;
  is_admin?: boolean;
  joined_at?: string;
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface ChatRoom {
  id: string;
  name?: string;
  type?: string;
  participants?: Participant[];
}

interface ChatRoomParticipantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: ChatRoom | null;
  onRoomLeft?: () => void;
}

export function ChatRoomParticipantsModal({ 
  open, 
  onOpenChange, 
  room,
  onRoomLeft
}: ChatRoomParticipantsModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  if (!room) return null;

  const participants = room.participants || [];
  const currentUserParticipant = participants.find(p => p.user_id === user?.id);
  const isCurrentUserAdmin = currentUserParticipant?.is_admin;
  const isDirectChat = room.type === "direct" || participants.length === 2;

  const handleLeaveRoom = async () => {
    if (!user || !room) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/chat/rooms/${room.id}/leave`, {
        method: "POST",
      });
      
      if (response.ok) {
        onOpenChange(false);
        
        // Service Worker 캐시 무효화
        if (window.invalidateChatCache) {
          window.invalidateChatCache('rooms');
        }
        
        // 부모 컴포넌트에게 알림
        if (onRoomLeft) {
          onRoomLeft();
        } else {
          // fallback으로 새로고침
          window.location.reload();
        }
      }
    } catch (error) {
      console.error("Error leaving room:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!isCurrentUserAdmin) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/chat/rooms/${room.id}/participants/${participantId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        // 참여자 목록 새로고침 필요
        window.location.reload();
      }
    } catch (error) {
      console.error("Error removing participant:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {isDirectChat ? "채팅 정보" : `참여자 (${participants.length}명)`}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isDirectChat ? "사용자 추가" : "초대"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {participants.map((participant) => {
            const isCurrentUser = participant.user_id === user?.id;
            const isAdmin = participant.is_admin;
            
            return (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.user?.avatar_url} />
                    <AvatarFallback>
                      {participant.user?.username?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {participant.user?.username || "알 수 없는 사용자"}
                        {isCurrentUser && " (나)"}
                      </span>
                      {isAdmin && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          관리자
                        </Badge>
                      )}
                    </div>
                    {participant.joined_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(participant.joined_at).toLocaleDateString()} 참여
                      </p>
                    )}
                  </div>
                </div>

                {/* 액션 메뉴 */}
                {!isCurrentUser && isCurrentUserAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRemoveParticipant(participant.id)}
                        className="text-destructive"
                        disabled={loading}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        내보내기
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 액션 버튼들 */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={handleLeaveRoom}
            disabled={loading}
          >
            {isDirectChat ? "채팅 나가기" : "채팅방 나가기"}
          </Button>
        </div>
      </DialogContent>
      
      {/* 사용자 초대 모달 */}
      <CreateChatModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        mode="invite"
        roomId={room.id}
      />
    </Dialog>
  );
}
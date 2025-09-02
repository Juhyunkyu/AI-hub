"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";

interface Participant {
  user_id: string;
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface ChatRoomAvatarProps {
  participants?: Participant[];
  type?: string;
  size?: "sm" | "md" | "lg";
}

export function ChatRoomAvatar({ participants = [], type, size = "md" }: ChatRoomAvatarProps) {
  const { user } = useAuthStore();
  
  // 현재 사용자를 제외한 참여자들
  const otherParticipants = participants.filter(p => p.user_id !== user?.id);
  
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10", 
    lg: "h-12 w-12"
  };
  
  const smallAvatarClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  // 1:1 채팅 (상대방 1명)
  if (otherParticipants.length === 1) {
    const participant = otherParticipants[0];
    return (
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={participant.user?.avatar_url} />
        <AvatarFallback>
          {participant.user?.username?.charAt(0) || "?"}
        </AvatarFallback>
      </Avatar>
    );
  }

  // 그룹 채팅 (2명 이상)
  if (otherParticipants.length >= 2) {
    const displayParticipants = otherParticipants.slice(0, 4); // 최대 4명까지만 표시
    
    return (
      <div className={`relative ${sizeClasses[size]}`}>
        {/* 배경 원 */}
        <div className={`${sizeClasses[size]} bg-muted rounded-full border-2 border-background`} />
        
        {/* 참여자 아바타들을 격자로 배치 */}
        <div className="absolute inset-0 p-0.5">
          {displayParticipants.length === 2 && (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {displayParticipants.map((participant, index) => (
                <Avatar key={participant.user_id} className={smallAvatarClasses[size]}>
                  <AvatarImage src={participant.user?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {participant.user?.username?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
          
          {displayParticipants.length === 3 && (
            <div className="h-full">
              <div className="flex justify-center mb-0.5">
                <Avatar className={smallAvatarClasses[size]}>
                  <AvatarImage src={displayParticipants[0].user?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {displayParticipants[0].user?.username?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {displayParticipants.slice(1).map((participant) => (
                  <Avatar key={participant.user_id} className={smallAvatarClasses[size]}>
                    <AvatarImage src={participant.user?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {participant.user?.username?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          )}
          
          {displayParticipants.length >= 4 && (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {displayParticipants.slice(0, 4).map((participant) => (
                <Avatar key={participant.user_id} className={smallAvatarClasses[size]}>
                  <AvatarImage src={participant.user?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {participant.user?.username?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>
        
        {/* 4명 이상일 때 숫자 표시 */}
        {otherParticipants.length > 4 && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
            +{otherParticipants.length - 4}
          </div>
        )}
      </div>
    );
  }

  // 참여자가 없는 경우 (기본)
  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarFallback>?</AvatarFallback>
    </Avatar>
  );
}
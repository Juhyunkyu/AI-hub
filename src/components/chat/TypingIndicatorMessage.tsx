"use client";

import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TypingIndicatorMessageProps {
  userId: string;
  participants: {
    id: string;
    user_id: string;
    user?: {
      id: string;
      username: string;
      avatar_url?: string | null;
    };
  }[];
}

// 메시지 영역 내에서 사용되는 타이핑 인디케이터 컴포넌트
export const TypingIndicatorMessage = memo(function TypingIndicatorMessage({
  userId,
  participants
}: TypingIndicatorMessageProps) {
  // 타이핑 중인 사용자 정보 찾기
  const participant = participants.find(p =>
    p.user_id === userId || p.user?.id === userId
  );

  const username = participant?.user?.username || "알 수 없는 사용자";
  const avatarUrl = participant?.user?.avatar_url;

  return (
    <div style={{
      width: '100%',
      padding: '2px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      boxSizing: 'border-box'
    }}>
      <div className="flex justify-start gap-2 w-full">
        {/* 사용자 아바타 */}
        <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
          <AvatarImage src={avatarUrl || undefined} alt={username} />
          <AvatarFallback className="text-xs">
            {username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* 메시지 컨테이너 - 일반 메시지와 동일한 구조 */}
        <div className="flex flex-col items-start max-w-[70%] min-w-0 flex-shrink-0">
          {/* 사용자 이름 (메시지 위에) */}
          <div className="text-xs text-muted-foreground mb-2">
            {username}
          </div>

          {/* 타이핑 버블 (메시지 아래) */}
          <div className="bg-muted px-3 py-2 rounded-lg inline-block">
            <div className="flex items-center space-x-1">
              {/* 타이핑 애니메이션 점들 */}
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
              </div>
              <span className="text-sm text-muted-foreground ml-2">입력 중...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
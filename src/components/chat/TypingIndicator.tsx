"use client";

import { useAuthStore } from "@/stores/auth";

interface TypingIndicatorProps {
  typingUsers: string[];
  participants?: {
    id: string;
    user_id: string;
    user?: {
      id: string;
      username: string;
      avatar_url?: string | null;
    };
  }[];
}

export function TypingIndicator({ typingUsers, participants = [] }: TypingIndicatorProps) {
  const { user } = useAuthStore();

  // 현재 사용자 제외한 타이핑 중인 사용자들
  const otherTypingUsers = typingUsers.filter(userId => userId !== user?.id);

  if (otherTypingUsers.length === 0) return null;

  // 디버깅: 데이터 구조 확인
  if (process.env.NODE_ENV === 'development') {
    console.log('TypingIndicator Debug:', {
      typingUsers,
      otherTypingUsers,
      participants: participants.map(p => ({
        id: p.id,
        user_id: p.user_id,
        username: p.user?.username
      }))
    });
  }

  // 타이핑 중인 사용자 이름들 가져오기
  const typingUserNames = otherTypingUsers
    .map(userId => {
      // user_id로 찾거나 user.id로 찾기
      const participant = participants.find(p =>
        p.user_id === userId || p.user?.id === userId
      );
      return participant?.user?.username || "알 수 없는 사용자";
    })
    .filter(Boolean);

  const getTypingText = () => {
    if (typingUserNames.length === 1) {
      return `${typingUserNames[0]}님이 입력 중`;
    } else if (typingUserNames.length === 2) {
      return `${typingUserNames[0]}님과 ${typingUserNames[1]}님이 입력 중`;
    } else {
      return `${typingUserNames[0]}님 외 ${typingUserNames.length - 1}명이 입력 중`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
        </div>
        <span>{getTypingText()}...</span>
      </div>
    </div>
  );
}
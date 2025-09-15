"use client";
"use memo";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { ChatLayout } from "@/components/chat/chat-layout";

export default function ChatPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">로그인이 필요합니다</h2>
          <p className="text-muted-foreground">
            채팅을 사용하려면 로그인해주세요
          </p>
        </div>
      </div>
    );
  }

  return <ChatLayout initialRoomId={roomId || undefined} />;
}















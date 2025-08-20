"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Reply, User } from "lucide-react";
import { MessageWithUsers } from "@/types/message";
import { toast } from "sonner";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";

export default function MessageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const [message, setMessage] = useState<MessageWithUsers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && params.id) {
      loadMessage();
    }
  }, [user, params.id]);

  const loadMessage = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/messages/${params.id}`);

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
      } else {
        toast.error("쪽지를 불러오는데 실패했습니다");
        router.push("/messages");
      }
    } catch (error) {
      console.error("Error loading message:", error);
      toast.error("쪽지를 불러오는데 실패했습니다");
      router.push("/messages");
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async () => {
    if (!message) return;

    try {
      const response = await fetch(`/api/messages/${message.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("쪽지가 삭제되었습니다");
        router.push("/messages");
      } else {
        toast.error("쪽지 삭제에 실패했습니다");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("쪽지 삭제에 실패했습니다");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-20">
          <h2 className="text-xl font-semibold mb-2">로그인이 필요합니다</h2>
          <p className="text-muted-foreground mb-4">
            쪽지를 보려면 로그인해주세요
          </p>
          <Link href="/login">
            <Button>로그인하기</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-20">
          <h2 className="text-xl font-semibold mb-2">
            쪽지를 찾을 수 없습니다
          </h2>
          <p className="text-muted-foreground mb-4">
            해당 쪽지가 존재하지 않거나 삭제되었습니다
          </p>
          <Link href="/messages">
            <Button>쪽지함으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isReceived = message.to_user_id === user.id;
  const sender = isReceived ? message.from_user : message.to_user;

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">쪽지</h1>
            <div className="ml-auto flex items-center gap-2">
              {isReceived && (
                <Link
                  href={`/messages/new?to=${message.from_user_id}&subject=Re: ${encodeURIComponent(message.subject)}`}
                >
                  <Button variant="outline" size="sm" className="h-8 px-3">
                    <Reply className="h-4 w-4 mr-1" />
                    답장
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={deleteMessage}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 쪽지 내용 */}
      <div className="max-w-md mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                userId={sender.id}
                username={sender.username}
                avatarUrl={sender.avatar_url}
                size="md"
                showActions={true}
                isOwner={false}
                showName={true}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {isReceived ? "받은 쪽지" : "보낸 쪽지"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(message.created_at)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  {message.subject}
                </h2>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                </div>
              </div>

              {!message.read && isReceived && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                  <span>읽지 않음</span>
                </div>
              )}

              {/* 답장 버튼 */}
              {isReceived && (
                <div className="pt-4 border-t">
                  <Link
                    href={`/messages/new?to=${message.from_user_id}&subject=Re: ${encodeURIComponent(message.subject)}`}
                  >
                    <Button variant="outline" className="w-full">
                      <Reply className="h-4 w-4 mr-2" />
                      답장 보내기
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

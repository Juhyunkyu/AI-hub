"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageWithUsers, MessageStats } from "@/types/message";
import { MessageSquare, Send, Inbox, Mail, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
// import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function MessagesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageWithUsers[]>([]);
  const [stats, setStats] = useState<MessageStats>({
    unread_count: 0,
    total_received: 0,
    total_sent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("received");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);

  // const supabase = createSupabaseBrowserClient();

  const loadMessages = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/messages?type=${activeTab}&page=${page}&limit=20`
      );

      if (response.ok) {
        const data = await response.json();

        if (page === 1) {
          setMessages(data.messages);
        } else {
          setMessages((prev) => [...prev, ...data.messages]);
        }

        setHasMore(data.hasMore);
      } else {
        toast.error("쪽지를 불러오는데 실패했습니다");
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("쪽지를 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, page]);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/messages/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        loadStats(); // 통계 업데이트
        toast.success("쪽지가 삭제되었습니다");
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new Event("messages:refresh"));
          } catch {}
        }
      } else {
        toast.error("쪽지 삭제에 실패했습니다");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("쪽지 삭제에 실패했습니다");
    }
  };

  // 카드 단위 체크박스는 제거되었으므로 개별 토글은 사용하지 않음

  const clearSelection = () => setSelectedIds(new Set());

  const allSelectedOnPage = useMemo(() => {
    if (!messages.length) return false;
    return messages.every((m) => selectedIds.has(m.id));
  }, [messages, selectedIds]);

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        messages.forEach((m) => next.delete(m.id));
      } else {
        messages.forEach((m) => next.add(m.id));
      }
      return next;
    });
  };

  const batchDelete = async () => {
    if (!selectedIds.size) return;
    try {
      const response = await fetch("/api/messages/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (response.ok) {
        setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
        clearSelection();
        toast.success("선택한 쪽지를 삭제했습니다");
        loadStats();
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new Event("messages:refresh"));
          } catch {}
        }
      } else {
        toast.error("일괄 삭제에 실패했습니다");
      }
    } catch {
      toast.error("일괄 삭제에 실패했습니다");
    }
  };

  const batchMarkRead = async (read: boolean) => {
    if (!selectedIds.size) return;
    setMarking(true);
    try {
      const response = await fetch("/api/messages/batch-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), read }),
      });
      if (response.ok) {
        // 로컬 상태 갱신
        setMessages((prev) =>
          prev.map((m) => (selectedIds.has(m.id) ? { ...m, read } : m))
        );
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new Event("messages:refresh"));
          } catch {}
        }
        loadStats();
        toast.success(
          read
            ? "선택한 쪽지를 읽음으로 표시했습니다"
            : "선택한 쪽지를 읽지 않음으로 표시했습니다"
        );
      } else {
        toast.error("일괄 처리에 실패했습니다");
      }
    } catch {
      toast.error("일괄 처리에 실패했습니다");
    } finally {
      setMarking(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 168) {
      // 7일
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });
    } else {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadStats();
      loadMessages();
    }
  }, [user, loadMessages]);

  // 페이지 진입 시 받은 쪽지 읽음 처리 (배지 제거)
  useEffect(() => {
    if (!user) return;
    if (activeTab !== "received") return;
    // 비동기 처리
    (async () => {
      try {
        const res = await fetch("/api/messages/read-all", { method: "PATCH" });
        if (res.ok) {
          // 로컬 상태 즉시 반영 (읽지 않은 메시지들을 읽음으로 표시)
          setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
        }
        // 네비게이션 배지 갱신 이벤트
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new Event("messages:refresh"));
          } catch {}
        }
        // 통계 재조회
        loadStats();
      } catch {}
    })();
  }, [user, activeTab]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-20">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">로그인이 필요합니다</h2>
          <p className="text-muted-foreground mb-4">
            쪽지를 보내고 받으려면 로그인해주세요
          </p>
          <Link href="/login">
            <Button>로그인하기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">쪽지함</h1>
            <div className="flex items-center gap-2">
              <Link href="/messages/new">
                <Button size="sm" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          {/* 통계 영역 제거 */}
        </div>
      </div>

      {/* 탭 */}
      <div className="max-w-md mx-auto px-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            setPage(1);
            setMessages([]);
            clearSelection();
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              받은 쪽지
              {stats.total_received > 0 && (
                <Badge
                  className="ml-1 h-5 px-1 text-[10px]"
                  variant="secondary"
                >
                  {stats.total_received}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              보낸 쪽지
              {stats.total_sent > 0 && (
                <Badge
                  className="ml-1 h-5 px-1 text-[10px]"
                  variant="secondary"
                >
                  {stats.total_sent}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4">
            <div className="space-y-3">
              {/* 상단 툴바: Sticky */}
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border rounded px-3 py-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleSelectAllOnPage}
                    aria-label="전체 선택"
                    className="h-4 w-4"
                  />
                  전체 선택
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedIds.size || marking}
                    onClick={() => batchMarkRead(true)}
                  >
                    읽음 표시
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={!selectedIds.size}
                    onClick={batchDelete}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              {messages.map((message) => (
                <Card
                  key={message.id}
                  className={`cursor-pointer transition-colors ${
                    !message.read ? "border-primary/20 bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    router.push(`/messages/${message.id}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {message.from_user?.username || "알 수 없음"}
                          </span>
                          {!message.read && (
                            <Badge variant="secondary" className="text-xs">
                              새
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-medium text-sm mb-1 truncate">
                          {message.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(message.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMessage(message.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* 카드 체크박스 제거 */}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {loading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}

              {!loading && messages.length === 0 && (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === "received"
                      ? "받은 쪽지가 없습니다"
                      : "보낸 쪽지가 없습니다"}
                  </p>
                </div>
              )}

              {hasMore && !loading && (
                <div className="text-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    더 보기
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            <div className="space-y-3">
              {/* 보낸 쪽지 툴바: Sticky (전체 선택 + 삭제) */}
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border rounded px-3 py-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleSelectAllOnPage}
                    aria-label="전체 선택"
                    className="h-4 w-4"
                  />
                  전체 선택
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={!selectedIds.size}
                    onClick={batchDelete}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              {messages.map((message) => (
                <Card
                  key={message.id}
                  className="cursor-pointer"
                  onClick={() => {
                    router.push(`/messages/${message.id}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {message.to_user?.username || "알 수 없음"}
                          </span>
                        </div>
                        <h3 className="font-medium text-sm mb-1 truncate">
                          {message.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(message.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMessage(message.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {loading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}

              {!loading && messages.length === 0 && (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">보낸 쪽지가 없습니다</p>
                </div>
              )}

              {hasMore && !loading && (
                <div className="text-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    더 보기
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

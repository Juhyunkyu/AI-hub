"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, User, Search } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface User {
  id: string;
  username: string;
  avatar_url?: string;
}

export default function NewMessagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [recipient, setRecipient] = useState<User | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const supabase = createSupabaseBrowserClient();

  // URL 파라미터에서 받는 사람 ID와 제목 확인
  useEffect(() => {
    const toUserId = searchParams.get("to");
    const subjectParam = searchParams.get("subject");

    if (toUserId) {
      loadRecipient(toUserId);
    }

    if (subjectParam) {
      setSubject(decodeURIComponent(subjectParam));
    }
  }, [searchParams]);

  const loadRecipient = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", userId)
        .single();

      if (error) {
        toast.error("사용자를 찾을 수 없습니다");
        return;
      }

      setRecipient(data);
    } catch (error) {
      console.error("Error loading recipient:", error);
      toast.error("사용자 정보를 불러오는데 실패했습니다");
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${query}%`)
        .limit(10);

      if (error) {
        console.error("Error searching users:", error);
        return;
      }

      // 자기 자신 제외
      const filteredUsers = data?.filter((u) => u.id !== user?.id) || [];
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    searchUsers(value);
  };

  const selectRecipient = (user: User) => {
    setRecipient(user);
    setSearchQuery(user.username);
    setShowSearch(false);
    setSearchResults([]);
  };

  const sendMessage = async () => {
    if (!user || !recipient) {
      toast.error("받는 사람을 선택해주세요");
      return;
    }

    if (!subject.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }

    if (!content.trim()) {
      toast.error("내용을 입력해주세요");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to_user_id: recipient.id,
          subject: subject.trim(),
          content: content.trim(),
        }),
      });

      if (response.ok) {
        toast.success("쪽지가 전송되었습니다");
        router.push("/messages");
      } else {
        const error = await response.json();
        toast.error(error.error || "쪽지 전송에 실패했습니다");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("쪽지 전송에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-20">
          <h2 className="text-xl font-semibold mb-2">로그인이 필요합니다</h2>
          <p className="text-muted-foreground mb-4">
            쪽지를 보내려면 로그인해주세요
          </p>
          <Button onClick={() => router.push("/login")}>로그인하기</Button>
        </div>
      </div>
    );
  }

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
            <h1 className="text-xl font-semibold">쪽지 보내기</h1>
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="max-w-md mx-auto p-4 space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* 받는 사람 선택 */}
            <div className="space-y-2">
              <label
                htmlFor="recipient"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                받는 사람
              </label>
              <div className="relative">
                <div className="flex items-center gap-2 p-3 border rounded-md bg-background">
                  {recipient ? (
                    <>
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {recipient.avatar_url ? (
                          <img
                            src={recipient.avatar_url}
                            alt="avatar"
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{recipient.username}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-auto"
                        onClick={() => {
                          setRecipient(null);
                          setSearchQuery("");
                        }}
                      >
                        ×
                      </Button>
                    </>
                  ) : (
                    <Input
                      id="recipient"
                      placeholder="사용자명으로 검색..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => setShowSearch(true)}
                      className="border-0 p-0 h-auto focus-visible:ring-0"
                    />
                  )}
                </div>

                {/* 검색 결과 */}
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                        onClick={() => selectRecipient(user)}
                      >
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt="avatar"
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium">{user.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 제목 */}
            <div className="space-y-2">
              <label
                htmlFor="subject"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                제목
              </label>
              <Input
                id="subject"
                placeholder="쪽지 제목을 입력하세요"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* 내용 */}
            <div className="space-y-2">
              <label
                htmlFor="content"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                내용
              </label>
              <Textarea
                id="content"
                placeholder="쪽지 내용을 입력하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                maxLength={1000}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground text-right">
                {content.length}/1000
              </div>
            </div>

            {/* 전송 버튼 */}
            <Button
              onClick={sendMessage}
              disabled={
                loading || !recipient || !subject.trim() || !content.trim()
              }
              className="w-full"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  쪽지 보내기
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

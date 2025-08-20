"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Shield, User, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type User = {
  id: string;
  username: string | null;
  role: string;
  created_at: string;
  avatar_url: string | null;
};

export function UserManagementClient({
  initialUsers,
}: {
  initialUsers: User[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  // 검색 및 필터링
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // 역할 변경
  const updateUserRole = async (userId: string, newRole: string) => {
    setLoading(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
      toast.success("사용자 역할이 업데이트되었습니다.");
    } catch (error) {
      console.error("역할 업데이트 오류:", error);
      toast.error("역할 업데이트에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  };

  // 사용자 삭제 (신중하게)
  const deleteUser = async (userId: string) => {
    if (
      !confirm(
        "정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    setLoading(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      setUsers(users.filter((user) => user.id !== userId));
      toast.success("사용자가 삭제되었습니다.");
    } catch (error) {
      console.error("사용자 삭제 오류:", error);
      toast.error("사용자 삭제에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용자 목록</CardTitle>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="사용자명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">모든 사용자</option>
            <option value="admin">관리자</option>
            <option value="user">일반 사용자</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="avatar"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="font-medium">
                    {user.username || "익명 사용자"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    가입일: {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={user.role === "admin" ? "default" : "secondary"}
                >
                  {user.role === "admin" ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      관리자
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3 mr-1" />
                      일반 사용자
                    </>
                  )}
                </Badge>
                <select
                  value={user.role}
                  onChange={(e) => updateUserRole(user.id, e.target.value)}
                  disabled={loading === user.id}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="user">일반 사용자</option>
                  <option value="admin">관리자</option>
                </select>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteUser(user.id)}
                  disabled={loading === user.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

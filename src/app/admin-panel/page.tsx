import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  FileText,
  MessageSquare,
  Settings,
  TrendingUp,
} from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();

  // 통계 데이터 가져오기
  const [
    { count: userCount },
    { count: postCount },
    { count: commentCount },
    { data: recentUsers },
    { data: recentPosts },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("posts").select("*", { count: "exact", head: true }),
    supabase.from("comments").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id,username,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("posts")
      .select("id,title,created_at,author_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    {
      title: "총 사용자",
      value: userCount || 0,
      icon: Users,
      description: "등록된 사용자 수",
      color: "text-blue-600",
    },
    {
      title: "총 게시글",
      value: postCount || 0,
      icon: FileText,
      description: "작성된 게시글 수",
      color: "text-green-600",
    },
    {
      title: "총 댓글",
      value: commentCount || 0,
      icon: MessageSquare,
      description: "작성된 댓글 수",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-muted-foreground">사이트 전반의 관리 및 모니터링</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stat.value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 최근 사용자 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                최근 가입 사용자
              </div>
              <a
                href="/admin-panel/users"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                더 보기 →
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentUsers && recentUsers.length > 0 ? (
              <div className="space-y-2">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <span className="font-medium">
                      {user.username || "익명 사용자"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                최근 가입한 사용자가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 최근 게시글 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                최근 게시글
              </div>
              <a
                href="/admin-panel/posts"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                더 보기 →
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPosts && recentPosts.length > 0 ? (
              <div className="space-y-2">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <span className="font-medium truncate max-w-[200px]">
                      {post.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                최근 작성된 게시글이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 빠른 액션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            빠른 액션
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <a
              href="/admin-panel/users"
              className="flex items-center gap-2 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <Users className="h-4 w-4" />
              <span>사용자 관리</span>
            </a>
            <a
              href="/admin-panel/posts"
              className="flex items-center gap-2 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>게시글 관리</span>
            </a>
            <a
              href="/admin-panel/comments"
              className="flex items-center gap-2 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>댓글 관리</span>
            </a>
            <a
              href="/admin-panel/settings"
              className="flex items-center gap-2 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>사이트 설정</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

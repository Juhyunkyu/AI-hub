import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";

export default async function CommentsManagementPage() {
  const supabase = createSupabaseServerClient();

  // 모든 댓글 데이터 가져오기 (작성자 및 게시글 정보 포함)
  const { data: commentsRaw, error } = await supabase
    .from("comments")
    .select(
      `
      id, 
      body, 
      created_at, 
      updated_at,
      author_id,
      post_id,
      profiles!comments_author_id_fkey(username),
      posts!comments_post_id_fkey(title)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching comments:", error);
  }

  type JoinedUser = { username: string };
  type JoinedPost = { title: string };
  type CommentWithJoins = {
    id: string;
    body: string;
    created_at: string;
    updated_at: string;
    author_id: string;
    post_id: string;
    profiles: JoinedUser | JoinedUser[] | null;
    posts: JoinedPost | JoinedPost[] | null;
  };

  const comments: CommentWithJoins[] =
    (commentsRaw as unknown as CommentWithJoins[] | null) ?? [];

  const stats = {
    total: comments?.length || 0,
    today:
      comments?.filter((comment) => {
        const today = new Date();
        const commentDate = new Date(comment.created_at);
        return commentDate.toDateString() === today.toDateString();
      }).length || 0,
    thisWeek:
      comments?.filter((comment) => {
        const today = new Date();
        const commentDate = new Date(comment.created_at);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return commentDate >= weekAgo;
      }).length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">댓글 관리</h1>
        <p className="text-muted-foreground">전체 댓글 목록 및 관리</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 댓글</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 작성</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 주</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <CardTitle>검색 및 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="댓글 내용으로 검색..."
                className="w-full pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              필터
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>댓글 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comments && comments.length > 0 ? (
              comments.map((comment) => {
                const postTitle = Array.isArray(comment.posts)
                  ? (comment.posts[0] as { title?: string } | undefined)?.title
                  : (comment.posts as { title?: string } | null | undefined)
                      ?.title;
                const authorUsername = Array.isArray(comment.profiles)
                  ? (comment.profiles[0] as { username?: string } | undefined)
                      ?.username
                  : (
                      comment.profiles as
                        | { username?: string }
                        | null
                        | undefined
                    )?.username;

                return (
                  <div
                    key={comment.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">
                            게시글:{" "}
                            <span className="font-medium">
                              {postTitle || "삭제된 게시글"}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            작성자:{" "}
                            <span className="font-medium">
                              {authorUsername || "익명"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm mb-2">{comment.body}</div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>
                          작성일:{" "}
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                        {comment.updated_at !== comment.created_at && (
                          <span>
                            수정일:{" "}
                            {new Date(comment.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                댓글이 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge"; // Currently unused
import { FileText, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";

export default async function PostsManagementPage() {
  const supabase = await createSupabaseServerClient();

  // 모든 게시글 데이터 가져오기 (작성자 정보 포함)
  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      `
      id, 
      title, 
      content, 
      created_at, 
      updated_at,
      author_id,
      profiles!posts_author_id_fkey(username)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
  }

  const stats = {
    total: posts?.length || 0,
    today:
      posts?.filter((post) => {
        const today = new Date();
        const postDate = new Date(post.created_at);
        return postDate.toDateString() === today.toDateString();
      }).length || 0,
    thisWeek:
      posts?.filter((post) => {
        const today = new Date();
        const postDate = new Date(post.created_at);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return postDate >= weekAgo;
      }).length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">게시글 관리</h1>
        <p className="text-muted-foreground">전체 게시글 목록 및 관리</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 게시글</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 작성</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 주</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
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
                placeholder="제목으로 검색..."
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

      {/* 게시글 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>게시글 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {posts && posts.length > 0 ? (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{post.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {post.content}
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            작성자:{" "}
                            {(() => {
                              const p = (
                                post as unknown as {
                                  profiles?:
                                    | { username?: string }
                                    | { username?: string }[];
                                }
                              ).profiles;
                              if (Array.isArray(p))
                                return p[0]?.username ?? "익명";
                              return p?.username ?? "익명";
                            })()}
                          </span>
                          <span>
                            작성일:{" "}
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                          {post.updated_at !== post.created_at && (
                            <span>
                              수정일:{" "}
                              {new Date(post.updated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
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
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                게시글이 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

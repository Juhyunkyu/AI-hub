import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Filter } from "lucide-react";
import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default async function UsersManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}) {
  const supabase = await createSupabaseServerClient();

  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const limit = parseInt(params.limit || "20"); // 기본 20명
  const search = params.search || "";
  const offset = (page - 1) * limit;

  // 전체 사용자 수 조회 (통계용)
  const { count: totalCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // 페이지네이션된 사용자 목록 조회
  let query = supabase
    .from("profiles")
    .select("id, username, role, created_at, avatar_url, bio, updated_at")
    .order("created_at", { ascending: false });

  // 검색 필터 적용
  if (search) {
    query = query.ilike("username", `%${search}%`);
  }

  const { data: users, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching users:", error);
  }

  const stats = {
    total: totalCount || 0,
    admin: 0, // 전체 관리자 수는 별도 쿼리 필요
    user: 0, // 전체 사용자 수는 별도 쿼리 필요
  };

  // 관리자/일반 사용자 수 조회
  const { count: adminCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "user");

  stats.admin = adminCount || 0;
  stats.user = userCount || 0;

  // 페이지네이션 계산
  const totalPages = Math.ceil((totalCount || 0) / limit);
  const currentPage = page;
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // 페이지 번호 생성 (최대 5개)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push(-1); // ellipsis
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push(-1); // ellipsis
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">사용자 관리</h1>
        <p className="text-muted-foreground">전체 사용자 목록 및 관리</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">관리자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admin}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">일반 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user}</div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <CardTitle>검색 및 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 검색바 */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="사용자명으로 검색..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md"
                  defaultValue={search}
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                고급 필터
              </Button>
            </div>

            {/* 고급 필터 옵션 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">역할</label>
                <select className="w-full mt-1 p-2 border rounded-md">
                  <option value="">모든 역할</option>
                  <option value="admin">관리자</option>
                  <option value="user">일반 사용자</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">가입일</label>
                <select className="w-full mt-1 p-2 border rounded-md">
                  <option value="">전체 기간</option>
                  <option value="today">오늘</option>
                  <option value="week">이번 주</option>
                  <option value="month">이번 달</option>
                  <option value="year">올해</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">페이지 크기</label>
                <select
                  className="w-full mt-1 p-2 border rounded-md"
                  defaultValue="20"
                >
                  <option value="10">10명씩</option>
                  <option value="20">20명씩</option>
                  <option value="50">50명씩</option>
                  <option value="100">100명씩</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">정렬</label>
                <select className="w-full mt-1 p-2 border rounded-md">
                  <option value="created_at_desc">가입일 (최신순)</option>
                  <option value="created_at_asc">가입일 (오래된순)</option>
                  <option value="username_asc">사용자명 (A-Z)</option>
                  <option value="username_desc">사용자명 (Z-A)</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 사용자 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>사용자 목록</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                선택된 사용자에게 채팅 보내기
              </Button>
              <Button variant="outline" size="sm">
                선택된 사용자 역할 변경
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users && users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label={`${user.username} 선택`}
                    />
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="avatar"
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <Users className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {user.username || "익명 사용자"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ID: {user.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.bio || "소개 없음"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        가입일: {new Date(user.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        역할: {user.role || "사용자"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        상태: <span className="text-green-600">활성</span>
                      </div>
                      {user.updated_at && (
                        <div className="text-xs text-muted-foreground">
                          최종 수정:{" "}
                          {new Date(user.updated_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                    >
                      {user.role === "admin" ? "관리자" : "사용자"}
                    </Badge>
                    <Button variant="outline" size="sm">
                      상세보기
                    </Button>
                    <Button variant="outline" size="sm">
                      역할 변경
                    </Button>
                    <Button variant="outline" size="sm">
                      계정 정지
                    </Button>
                    <Link href={`/chat?user=${user.id}`}>
                      <Button variant="outline" size="sm">
                        채팅 보내기
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                사용자가 없습니다.
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          <div className="mt-6">
            {totalPages > 1 ? (
              <>
                <Pagination>
                  <PaginationContent>
                    {hasPrevPage && (
                      <PaginationItem>
                        <PaginationPrevious
                          href={`/admin-panel/users?page=${currentPage - 1}&limit=${limit}${search ? `&search=${search}` : ""}`}
                        />
                      </PaginationItem>
                    )}

                    {getPageNumbers().map((pageNum, index) => (
                      <PaginationItem key={index}>
                        {pageNum === -1 ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href={`/admin-panel/users?page=${pageNum}&limit=${limit}${search ? `&search=${search}` : ""}`}
                            isActive={pageNum === currentPage}
                          >
                            {pageNum}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    {hasNextPage && (
                      <PaginationItem>
                        <PaginationNext
                          href={`/admin-panel/users?page=${currentPage + 1}&limit=${limit}${search ? `&search=${search}` : ""}`}
                        />
                      </PaginationItem>
                    )}
                  </PaginationContent>
                </Pagination>

                <div className="text-center mt-4 text-sm text-muted-foreground">
                  총 {totalCount}명의 사용자 중 {offset + 1}-
                  {Math.min(offset + limit, totalCount || 0)}번째 표시
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                총 {totalCount}명의 사용자 (모든 사용자 표시됨)
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

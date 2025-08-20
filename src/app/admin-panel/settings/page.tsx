import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings,
  Save,
  RefreshCw,
  Shield,
  Users,
  FileText,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">사이트 설정</h1>
        <p className="text-muted-foreground">사이트 전반의 설정 관리</p>
      </div>

      {/* 기본 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            기본 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">사이트 이름</Label>
              <Input id="site-name" defaultValue="AI Hub" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-description">사이트 설명</Label>
              <Input
                id="site-description"
                defaultValue="AI 정보 공유/교류 허브"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-url">사이트 URL</Label>
            <Input id="site-url" defaultValue="https://aihub.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">연락처 이메일</Label>
            <Input
              id="contact-email"
              type="email"
              defaultValue="admin@aihub.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* 사용자 관리 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            사용자 관리 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>새 사용자 가입 허용</Label>
              <p className="text-sm text-muted-foreground">
                새로운 사용자의 가입을 허용합니다
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>이메일 인증 필수</Label>
              <p className="text-sm text-muted-foreground">
                가입 시 이메일 인증을 필수로 합니다
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>관리자 승인 필요</Label>
              <p className="text-sm text-muted-foreground">
                새 사용자 가입 시 관리자 승인이 필요합니다
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* 콘텐츠 관리 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            콘텐츠 관리 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>게시글 사전 승인</Label>
              <p className="text-sm text-muted-foreground">
                게시글 작성 시 관리자 승인이 필요합니다
              </p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>댓글 사전 승인</Label>
              <p className="text-sm text-muted-foreground">
                댓글 작성 시 관리자 승인이 필요합니다
              </p>
            </div>
            <Switch />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-post-length">최대 게시글 길이</Label>
              <Input id="max-post-length" type="number" defaultValue="10000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-comment-length">최대 댓글 길이</Label>
              <Input
                id="max-comment-length"
                type="number"
                defaultValue="1000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 보안 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            보안 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>2단계 인증 필수</Label>
              <p className="text-sm text-muted-foreground">
                관리자 계정에 2단계 인증을 필수로 합니다
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>로그인 시도 제한</Label>
              <p className="text-sm text-muted-foreground">
                로그인 실패 시 일정 시간 동안 차단합니다
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-timeout">세션 타임아웃 (분)</Label>
              <Input id="session-timeout" type="number" defaultValue="60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-login-attempts">최대 로그인 시도 횟수</Label>
              <Input id="max-login-attempts" type="number" defaultValue="5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 유지보수 모드 */}
      <Card>
        <CardHeader>
          <CardTitle>유지보수 모드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>유지보수 모드 활성화</Label>
              <p className="text-sm text-muted-foreground">
                사이트를 유지보수 모드로 전환합니다
              </p>
            </div>
            <Switch />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">유지보수 메시지</Label>
            <Textarea
              id="maintenance-message"
              placeholder="사용자에게 표시할 유지보수 메시지를 입력하세요..."
              defaultValue="현재 사이트 점검 중입니다. 잠시만 기다려주세요."
            />
          </div>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex gap-4">
        <Button className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          설정 저장
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          기본값으로 복원
        </Button>
      </div>
    </div>
  );
}

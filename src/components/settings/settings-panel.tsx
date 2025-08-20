"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ColorThemeSwitcher } from "@/components/color-theme-switcher";
import { Separator } from "@/components/ui/separator";
import {
  Palette,
  Bell,
  Shield,
  Globe,
  Eye,
  Smartphone,
  Mail,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";

export function SettingsPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const user = useAuthStore((s) => s.user);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [dataCollection, setDataCollection] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [isEmailUser, setIsEmailUser] = useState(false);

  useEffect(() => {
    if (user) {
      // 이메일 사용자인지 확인 (소셜 로그인 여부 판단)
      setIsEmailUser(!!user.email && !user.app_metadata?.provider);
    }
  }, [user]);

  const handleSaveSettings = () => {
    // TODO: 설정 저장 로직 구현
    toast.success("설정이 저장되었습니다.");
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    if (newPassword.length < 6) return toast.error("비밀번호는 6자 이상");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return toast.error(error.message);

    toast.success("비밀번호가 변경되었습니다");
    setNewPassword("");
  };

  return (
    <div className="space-y-8">
      {/* 테마 설정 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">테마 설정</h2>
        </div>
        <div className="space-y-2">
          <ColorThemeSwitcher />
        </div>
      </div>

      <Separator />

      {/* 알림 설정 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">알림 설정</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">이메일 알림</Label>
              <p className="text-xs text-muted-foreground">
                새로운 메시지나 활동에 대한 이메일 알림을 받습니다
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">브라우저 알림</Label>
              <p className="text-xs text-muted-foreground">
                브라우저에서 푸시 알림을 받습니다
              </p>
            </div>
            <Switch
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* 개인정보 보호 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">개인정보 보호</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">프로필 공개</Label>
              <p className="text-xs text-muted-foreground">
                다른 사용자가 내 프로필을 볼 수 있습니다
              </p>
            </div>
            <Switch
              checked={profileVisibility}
              onCheckedChange={setProfileVisibility}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">데이터 수집 동의</Label>
              <p className="text-xs text-muted-foreground">
                서비스 개선을 위한 익명 데이터 수집에 동의합니다
              </p>
            </div>
            <Switch
              checked={dataCollection}
              onCheckedChange={setDataCollection}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* 계정 보안 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">계정 보안</h2>
        </div>
        <div className="space-y-4">
          {/* 이메일 사용자만 비밀번호 변경 표시 */}
          {isEmailUser && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">비밀번호 변경</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="새 비밀번호"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  onClick={handleUpdatePassword}
                  className="h-10"
                >
                  변경
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                비밀번호는 6자 이상이어야 합니다.
              </p>
            </div>
          )}
          {!isEmailUser && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                소셜 로그인 사용자는 비밀번호 변경이 불가능합니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings}>설정 저장</Button>
      </div>
    </div>
  );
}

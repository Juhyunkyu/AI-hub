"use client";

export function SettingsPanel() {
  // 프로필 페이지에서는 설정 관련 기능을 제거하고 안내 메시지만 표시
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-base font-semibold">프로필 정보</h2>
        <p className="text-sm text-muted-foreground">
          프로필 정보는 페이지에서 직접 편집할 수 있습니다.
        </p>
        <p className="text-sm text-muted-foreground">
          비밀번호 변경은 설정 페이지에서 가능합니다.
        </p>
      </div>
    </div>
  );
}

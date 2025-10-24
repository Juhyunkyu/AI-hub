import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "채팅 - AI Hub",
  description: "실시간 채팅",
};

/**
 * 채팅 페이지 전용 레이아웃
 * - 모바일: 전체 화면 모드 (푸터 제거, h-screen 고정)
 * - 데스크톱: 일반 레이아웃 유지
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 모바일: 전체 화면, 데스크톱: 일반 레이아웃 */}
      <div className="md:hidden fixed inset-0 top-[56px] bg-background">
        {children}
      </div>
      <div className="hidden md:block">
        {children}
      </div>
    </>
  );
}

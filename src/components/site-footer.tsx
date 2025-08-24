import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
        <div className="mb-4">
          <nav className="w-full flex items-center justify-center gap-4 sm:gap-8 whitespace-nowrap text-[11px] sm:text-sm">
            <Link href="/notice" className="hover:underline">
              공지사항
            </Link>
            <Link href="/terms" className="hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:underline">
              개인정보 처리방침
            </Link>
          </nav>
        </div>

        <div className="text-xs text-muted-foreground">
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-2">
              <span className="text-base">©</span>
              <span className="font-semibold tracking-tight">possible</span>
              <span>{year}</span>
              <span className="mx-1">·</span>
              <span>Crafted with modern web standards.</span>
            </span>
          </div>
        </div>
        <div className="mt-4 border-t" />
      </div>
    </footer>
  );
}

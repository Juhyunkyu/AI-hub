import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
          <Link href="/notice" className="text-center hover:underline">
            공지사항
          </Link>
          <Link href="/terms" className="text-center hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="text-center hover:underline">
            개인정보 처리방침
          </Link>
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

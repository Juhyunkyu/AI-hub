"use client";

import { useEffect, useRef, useMemo } from "react";
import { sanitizePostContent } from "@/lib/sanitize";

/**
 * 게시물 HTML 콘텐츠 렌더링 컴포넌트
 *
 * XSS 보안 강화:
 * - DOMPurify로 HTML sanitize (Context7 패턴)
 * - 안전한 태그만 허용 (p, strong, em, a, img, code 등)
 * - 위험한 속성 제거 (onclick, onerror 등)
 */
export function PostContent({ html }: { html: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Context7 Best Practice: useMemo로 sanitize 최적화
  const sanitizedHtml = useMemo(() => {
    return sanitizePostContent(html);
  }, [html]);

  useEffect(() => {
    // 목록 스타일 보정: Tailwind Typography 미적용 환경에서도 불릿/넘버링 표시
    const root = rootRef.current;
    if (root) {
      root.querySelectorAll<HTMLUListElement>("ul").forEach((ul) => {
        ul.classList.add("list-disc", "pl-6", "my-2");
      });
      root.querySelectorAll<HTMLOListElement>("ol").forEach((ol) => {
        ol.classList.add("list-decimal", "pl-6", "my-2");
      });
    }
  }, [sanitizedHtml]); // sanitizedHtml 의존성으로 변경

  return (
    <div
      ref={rootRef}
      className="prose dark:prose-invert max-w-none text-sm sm:text-base"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

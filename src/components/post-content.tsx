"use client";

import { useEffect, useRef } from "react";


export function PostContent({ html }: { html: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

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
  }, [html]);

  return (
    <div
      ref={rootRef}
      className="prose dark:prose-invert max-w-none text-sm sm:text-base"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

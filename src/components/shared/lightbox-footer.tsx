"use client";

import { type ReactNode } from "react";

interface LightboxFooterProps {
  children: ReactNode;
  ariaLabel?: string;
}

export function LightboxFooter({ children, ariaLabel = "Image editing toolbar" }: LightboxFooterProps) {
  return (
    <footer
      className="flex-none bg-black/95 backdrop-blur-md border-t border-white/10"
      role="toolbar"
      aria-label={ariaLabel}
    >
      <div className="safe-area-inset-bottom py-3 px-4">
        <div className="flex items-center justify-center">
          {children}
        </div>
      </div>
    </footer>
  );
}

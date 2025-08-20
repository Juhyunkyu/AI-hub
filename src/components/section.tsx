import * as React from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Section({ title, actions, className, children }: SectionProps) {
  return (
    <section
      className={cn("w-full space-y-3 sm:space-y-4 md:space-y-5", className)}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-base sm:text-lg md:text-xl font-semibold tracking-tight">
              {title}
            </h2>
          ) : (
            <div />
          )}
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

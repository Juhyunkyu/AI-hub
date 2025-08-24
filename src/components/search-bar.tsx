"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

export function SearchBar({
  actionPath,
  initialQuery = "",
  placeholder = "검색...",
  className = "",
}: {
  actionPath: string;
  initialQuery?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialQuery);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    startTransition(() => {
      const url = q ? `${actionPath}?q=${encodeURIComponent(q)}` : actionPath;
      router.push(url);
    });
  }

  return (
    <form onSubmit={onSubmit} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-24 text-xs sm:text-sm"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          검색
        </Button>
      </div>
    </form>
  );
}

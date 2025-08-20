"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";

export function ProfileLinks({
  userId,
  links,
}: {
  userId: string;
  links: any;
}) {
  const me = useAuthStore((s) => s.user);
  const supabase = createSupabaseBrowserClient();
  const isOwner = me?.id === userId;
  const [state, setState] = useState<Record<string, string>>({
    website: links?.website ?? "",
    github: links?.github ?? "",
    twitter: links?.twitter ?? "",
    linkedin: links?.linkedin ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!isOwner) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ links: { ...links, ...state } })
      .eq("id", userId);
    setSaving(false);
    if (error) return;
  }

  if (!isOwner) {
    const entries = Object.entries(state).filter(([, v]) => Boolean(v));
    if (entries.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 text-sm">
        {entries.map(([k, v]) => (
          <a
            key={k}
            href={v}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {k}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Website URL"
          value={state.website}
          onChange={(e) => setState({ ...state, website: e.target.value })}
        />
        <Input
          placeholder="GitHub URL"
          value={state.github}
          onChange={(e) => setState({ ...state, github: e.target.value })}
        />
        <Input
          placeholder="Twitter URL"
          value={state.twitter}
          onChange={(e) => setState({ ...state, twitter: e.target.value })}
        />
        <Input
          placeholder="LinkedIn URL"
          value={state.linkedin}
          onChange={(e) => setState({ ...state, linkedin: e.target.value })}
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="h-8" onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "링크 저장"}
        </Button>
      </div>
    </div>
  );
}

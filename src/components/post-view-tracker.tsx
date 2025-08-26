"use client";

import { useEffect } from "react";

export function PostViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    if (!postId) return;
    try {
      const key = "viewed_posts_v1";
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(key) : null;
      let map: Record<string, number> = {};
      if (raw) {
        try {
          map = JSON.parse(raw) as Record<string, number>;
        } catch {
          map = {};
        }
      }
      const last = map[postId] || 0;
      if (now - last < ONE_DAY_MS) return; // within 24h: skip
      // fire-and-forget
      fetch(`/api/posts/${encodeURIComponent(postId)}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then(() => {
          map[postId] = now;
          localStorage.setItem(key, JSON.stringify(map));
        })
        .catch(() => {
          // ignore network errors
        });
    } catch {
      // ignore storage errors
    }
  }, [postId]);

  return null;
}

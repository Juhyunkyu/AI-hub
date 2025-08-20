export function slugify(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    // Keep any unicode letters/numbers and hyphens
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized
}

export function safeSlug(input: string, prefix = "s"): string {
  const s = slugify(input)
  return s.length > 0 ? s : `${prefix}-${Date.now()}`
}

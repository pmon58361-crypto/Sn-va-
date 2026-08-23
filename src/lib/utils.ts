// Small shared helpers.

// Relative time formatter (e.g. "3h ago").
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function parseTags(tags?: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ── Explicit interests picker ────────────────────────────────────────────────

export const MAX_INTERESTS = 20;
export const MAX_INTEREST_LEN = 40;

/**
 * Normalize user-chosen interest topics into canonical stored form:
 * lowercase, trimmed, "#" stripped, inner whitespace collapsed, deduped
 * (case-insensitive), capped. Only ever fed by real user selections.
 */
export function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item
      .toLowerCase()
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, " ")
      .slice(0, MAX_INTEREST_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

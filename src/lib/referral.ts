// First-touch acquisition attribution. One rule: the original source
// wins — an existing snv_ref cookie is NEVER overwritten by a later
// ?ref= hit (last-touch muddies channel comparison; we measure discovery).

export const REF_COOKIE = "snv_ref";
export const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const DIRECT = "direct";

/** Whitelist+truncate: lowercase slug chars, max 32. Anything else (junk,
 *  URLs, injection attempts) resolves to null = untracked. */
export function sanitizeRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toLowerCase().slice(0, 32);
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(clean)) return null;
  return clean;
}

/** Explicit ?ref= param wins over the cookie (covers the iOS standalone
 *  gap where the cookie jar is isolated); cookie wins over "direct". */
export function resolveRef(
  explicit?: unknown,
  cookie?: unknown
): string {
  return sanitizeRef(explicit) ?? sanitizeRef(cookie) ?? DIRECT;
}

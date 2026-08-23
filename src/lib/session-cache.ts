// Short-lived per-user cache for the NextAuth session callback's identity
// fetch. Cuts a Neon round-trip per request while preserving instant
// propagation: profile/settings writes call invalidateSessionCache().
//
// Degradation ladder used by auth.ts:
//   fresh hit -> use it
//   miss      -> DB fetch, cache it
//   DB throw  -> stale entry even if expired (stale-if-error)
//   nothing   -> bare JWT claims (NextAuth defaults)
// Failures are NEVER cached as values — only successes are stored.

import { prisma } from "@/lib/prisma";

export type SessionUserData = {
  name: string | null;
  image: string | null;
  role: string;
  theme?: string;
  accent?: string;
  background?: string | null;
  isCreator: boolean;
};

const TTL_MS = 45_000;
const MAX_ENTRIES = 5000;

type Entry = { data: SessionUserData; cachedAt: number };

// globalThis guard keeps one map across dev HMR reloads.
const store =
  ((globalThis as unknown as { __snivatSessionCache?: Map<string, Entry> })
    .__snivatSessionCache ??= new Map<string, Entry>());

function evictIfNeeded() {
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Non-expired entry only. */
export function readFresh(id: string): SessionUserData | null {
  const e = store.get(id);
  if (!e) return null;
  if (Date.now() - e.cachedAt > TTL_MS) return null;
  return e.data;
}

/** Any entry, including expired — used only when the DB is unreachable. */
export function readStale(id: string): SessionUserData | null {
  return store.get(id)?.data ?? null;
}

export function writeSessionUser(id: string, data: SessionUserData) {
  evictIfNeeded();
  store.set(id, { data, cachedAt: Date.now() });
}

/** Called after any write that changes session-visible identity/settings. */
export function invalidateSessionCache(userId: string) {
  store.delete(userId);
}

// Kept for symmetry/future warmers — re-fetch straight from the DB.
export async function fetchSessionUser(
  id: string
): Promise<SessionUserData | null> {
  const row = await prisma.user.findUnique({
    where: { id },
    select: {
      name: true,
      image: true,
      role: true,
      settings: {
        select: { theme: true, accent: true, background: true, isCreator: true },
      },
    },
  });
  if (!row) return null;
  return {
    name: row.name,
    image: row.image,
    role: row.role,
    theme: row.settings?.theme,
    accent: row.settings?.accent,
    background: row.settings?.background,
    isCreator: row.settings?.isCreator ?? false,
  };
}

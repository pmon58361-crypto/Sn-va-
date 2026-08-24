// ── Presence (in-memory, zero-schema) ────────────────────────────────────────
//
// Client heartbeat (60s while tab visible) records which app AREA the user is
// in — never precise URLs. 3-minute TTL; same globalThis pattern as the
// session cache. Single-instance deployment keeps this authoritative.
//
// Privacy: users can silence the beacon per-browser via the Settings toggle
// (localStorage `presence-optout`); a proper cross-device opt-out column is
// bundled with the next additive schema push.

type Entry = { page: string; at: number };

const TTL_MS = 180_000;
const MAX_ENTRIES = 10_000;

const store =
  ((globalThis as unknown as {
    __snivatPresence?: Map<string, Entry>;
  }).__snivatPresence ??= new Map<string, Entry>());

function evict() {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.at > TTL_MS) store.delete(k);
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value as string);
  }
}

export function beat(userId: string, page: string): void {
  evict();
  store.set(userId, { page, at: Date.now() });
}

export type PresenceInfo = { online: boolean; page: string | null };

/** Online flag (+ current area for close contacts' UI) for the given ids. */
export function getPresence(ids: string[]): Record<string, PresenceInfo> {
  evict();
  const now = Date.now();
  const out: Record<string, PresenceInfo> = {};
  for (const id of ids) {
    const e = store.get(id);
    out[id] =
      e && now - e.at <= TTL_MS
        ? { online: true, page: e.page }
        : { online: false, page: null };
  }
  return out;
}

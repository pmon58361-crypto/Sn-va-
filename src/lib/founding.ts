import { prisma } from "@/lib/prisma";

// ── Founding Member badge (first 500 accounts) ───────────────────────────────
//
// Count-based and therefore always honest: a user qualifies iff their
// account was created no later than the 500th account ever made. No stored
// flag to drift out of sync — if early accounts get purged, the threshold
// self-corrects on the next refresh.
//
// The cutoff (500th createdAt) is cached for an hour; per-user results are
// memoized for 6h so feed rendering never hammers the DB.

const FOUNDING_LIMIT = Number(process.env.FOUNDING_MEMBER_LIMIT || 500);

let cutoffCache: { value: Date | null; at: number } | null = null;
const CUTOFF_TTL_MS = 3_600_000;

async function foundingCutoff(): Promise<Date | null> {
  if (cutoffCache && Date.now() - cutoffCache.at < CUTOFF_TTL_MS) {
    return cutoffCache.value;
  }
  const total = await prisma.user.count();
  if (total <= FOUNDING_LIMIT) {
    cutoffCache = { value: null, at: Date.now() }; // everyone qualifies
    return null;
  }
  const nth = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    skip: FOUNDING_LIMIT - 1,
    take: 1,
    select: { createdAt: true },
  });
  const value = nth[0]?.createdAt ?? null;
  cutoffCache = { value, at: Date.now() };
  return value;
}

const memo = new Map<string, { v: boolean; at: number }>();
const MEMO_TTL_MS = 6 * 3_600_000;
const MEMO_MAX_ENTRIES = 20_000;

export async function isFoundingMember(
  userId: string,
  createdAt?: Date | null
): Promise<boolean> {
  const hit = memo.get(userId);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.v;

  let v = false;
  try {
    const cutoff = await foundingCutoff();
    // No cutoff ⇒ population under the limit ⇒ everyone is founding.
    let created = createdAt ?? null;
    if (!created) {
      const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      });
      created = row?.createdAt ?? null;
    }
    v = !!created && (!cutoff || created <= cutoff);
  } catch {
    v = false; // DB hiccup never fakes a badge
  }

  memo.set(userId, { v, at: Date.now() });
  if (memo.size > MEMO_MAX_ENTRIES) memo.clear();
  return v;
}

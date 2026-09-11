import { prisma } from "@/lib/prisma";
import {
  spendCents,
  overBudget,
  eventCostMillicents,
  type BillableAd,
} from "./ads-money";

// Ad selectors for the two placements. Server-side uniform random pick over
// active + in-window + in-budget candidates; serving counts as one atomic
// impression. No third-party anything — selection, counting and redirect
// are all ours.
//
// BILLING (Phase 1: direct-sold, admin-managed). Money math lives in
// ./ads-money (no database import) so the admin UI and serving can never
// disagree — and client components can import it safely.
// overBudget() gates serving AND auto-pauses. Click spend accrues through
// recordAdClick(), which the click route calls (one line) — the route file
// itself is owned by another agent and stays untouched here.

export type AdPlacement = "FEED" | "SIDEBAR";

export type ServedAd = {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
};

export type { BillableAd };

function todayBucket(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function isInWindow(
  ad: { startsAt: Date | null; endsAt: Date | null },
  now: Date
) {
  return (
    (!ad.startsAt || ad.startsAt <= now) && (!ad.endsAt || ad.endsAt >= now)
  );
}

export function isValidAdWindow(ad: {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  return ad.active && isInWindow(ad, new Date());
}

async function pickAd(placement: AdPlacement): Promise<ServedAd | null> {
  const now = new Date();
  const candidates = await prisma.ad.findMany({
    where: {
      active: true,
      placement,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    select: {
      id: true,
      advertiser: true,
      headline: true,
      imageUrl: true,
      targetUrl: true,
      impressions: true,
      clicks: true,
      rateCpmCents: true,
      rateCpcCents: true,
      budgetCents: true,
    },
  });
  if (candidates.length === 0) return null;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  // Budget gate: derived spend already at budget → skip AND auto-pause, so
  // a spent ad stops everywhere on its next serve attempt (no cron needed).
  if (overBudget(picked)) {
    try {
      await prisma.ad.update({ where: { id: picked.id }, data: { active: false } });
    } catch (err) {
      console.warn("[ads] auto-pause failed:", err);
    }
    const rest = candidates.filter((c) => c.id !== picked.id && !overBudget(c));
    if (rest.length === 0) return null;
    return serveCandidate(rest[Math.floor(Math.random() * rest.length)]);
  }
  return serveCandidate(picked);
}

// Shared serve path: atomic impression increment + billable ledger row.
// Counting failures never block the render (worst case an impression goes
// uncounted); ledger rows only exist for billable serves.
async function serveCandidate(c: {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
  impressions: number;
  clicks: number;
  rateCpmCents: number | null;
  rateCpcCents: number | null;
  budgetCents: number | null;
}): Promise<ServedAd> {
  const after = { ...c, impressions: c.impressions + 1 };
  try {
    await prisma.ad.update({
      where: { id: c.id },
      data: {
        impressions: { increment: 1 },
        // Spend past budget mid-flight pauses here too, not next time.
        ...(overBudget(after) ? { active: false } : {}),
      },
    });
  } catch (err) {
    console.warn("[ads] impression increment failed:", err);
  }
  // Ledger is best-effort like the counter — billing tolerates a dropped
  // row the same way it tolerates a dropped increment (both derive from
  // the same serve, and spend is derived from counters, not summed rows).
  const cost = eventCostMillicents("impression", c);
  if (cost > 0) {
    try {
      await prisma.adEvent.create({
        data: { adId: c.id, type: "impression", costMillicents: cost, date: todayBucket() },
      });
    } catch (err) {
      console.warn("[ads] ledger insert failed:", err);
    }
  }
  return {
    id: c.id,
    advertiser: c.advertiser,
    headline: c.headline,
    imageUrl: c.imageUrl,
    targetUrl: c.targetUrl,
  };
}

/**
 * Click-side billing hook for the click route (one-line call — the route
 * file is owned by another agent, so this lives here ready to wire).
 * Writes ONLY the ledger row; the route owns the clicks counter, and the
 * two must never both increment. Never throws.
 */
export async function recordAdClick(adId: string): Promise<void> {
  try {
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      select: { rateCpcCents: true },
    });
    const cost = eventCostMillicents("click", {
      rateCpmCents: null,
      rateCpcCents: ad?.rateCpcCents ?? null,
    });
    if (cost <= 0) return;
    await prisma.adEvent.create({
      data: { adId, type: "click", costMillicents: cost, date: todayBucket() },
    });
  } catch (err) {
    console.warn("[ads] click ledger insert failed:", err);
  }
}

export function getFeedAd() {
  return pickAd("FEED");
}

export function getSidebarAd() {
  return pickAd("SIDEBAR");
}

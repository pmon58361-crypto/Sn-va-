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

async function pickAd(placement: AdPlacement, viewerId?: string | null): Promise<ServedAd | null> {
  const now = new Date();
  const candidates = await prisma.ad.findMany({
    where: {
      active: true,
      approved: true,
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
      topics: true,
    },
  });
  if (candidates.length === 0) return null;

  // Viewer context for targeting + caps. Best-effort lookups — any failure
  // degrades to untargeted/uncapped serving, never to a broken page.
  let interests: string[] = [];
  let servedToday = new Map<string, number>();
  if (viewerId) {
    try {
      const [settings, serves] = await Promise.all([
        prisma.settings.findUnique({
          where: { userId: viewerId },
          select: { interests: true },
        }),
        prisma.adEvent.groupBy({
          by: ["adId"],
          where: {
            viewerId,
            type: "impression",
            createdAt: { gte: new Date(now.getTime() - 86_400_000) },
          },
          _count: { _all: true },
        }),
      ]);
      interests = (settings?.interests || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      servedToday = new Map(serves.map((s) => [s.adId, s._count._all]));
    } catch (err) {
      console.warn("[ads] viewer context lookup failed:", err);
    }
  }
  const interestSet = new Set(interests);

  // Budget gate first (money stops), then frequency caps (annoyance stops).
  const eligible = candidates.filter((c) => {
    if (overBudget(c)) {
      prisma.ad
        .update({ where: { id: c.id }, data: { active: false } })
        .catch((err) => console.warn("[ads] auto-pause failed:", err));
      return false;
    }
    if (viewerId && (servedToday.get(c.id) || 0) >= FREQUENCY_CAP_PER_DAY) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  // Topic-weighted random: ads sharing topics with the viewer weigh more,
  // untargeted ads and viewers without interests keep weight 1 — fill rate
  // never suffers, relevance does the steering.
  const weights = eligible.map((c) => topicWeight(c.topics, interestSet));
  const total = weights.reduce((a, b) => a + b, 0);
  const picked = eligible[pickWeightedIndex(weights, total, Math.random())];
  return serveCandidate(picked, viewerId);
}

/** Weight of one ad for one viewer: 1 + 2 per shared topic. Pure. */
export function topicWeight(
  adTopics: string | null,
  interests: Set<string>
): number {
  if (!interests.size) return 1;
  const tags = (adTopics || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tags.length) return 1;
  return 1 + 2 * tags.filter((t) => interests.has(t)).length;
}

/** Index into weights by roll in [0, total). Pure, deterministic. */
export function pickWeightedIndex(
  weights: number[],
  total: number,
  roll: number
): number {
  let r = roll * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// Max serves of one ad to one viewer per rolling 24h. Annoyance cap, not
// billing — capped serves simply don't happen.
export const FREQUENCY_CAP_PER_DAY = 5;

// Shared serve path: atomic impression increment + billable ledger row.
// Counting failures never block the render (worst case an impression goes
// uncounted); ledger rows only exist for billable serves.
async function serveCandidate(
  c: {
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
  },
  viewerId?: string | null
): Promise<ServedAd> {
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
        data: {
          adId: c.id,
          type: "impression",
          costMillicents: cost,
          date: todayBucket(),
          viewerId: viewerId ?? null,
        },
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

export function getFeedAd(viewerId?: string | null) {
  return pickAd("FEED", viewerId);
}

export function getSidebarAd(viewerId?: string | null) {
  return pickAd("SIDEBAR", viewerId);
}

/**
 * Viewability counting for the client beacon (POST /api/ads/[id]/view).
 * Separate from served impressions: a view means the card was actually on
 * screen. Displayed in admin, not yet billed — billing still follows
 * served+CPC until viewability proves out. Never throws.
 */
export async function recordAdView(
  adId: string,
  viewerId?: string | null
): Promise<void> {
  try {
    await prisma.ad.update({
      where: { id: adId },
      data: { viewableImpressions: { increment: 1 } },
    });
  } catch (err) {
    console.warn("[ads] view increment failed:", err);
  }
  try {
    await prisma.adEvent.create({
      data: {
        adId,
        type: "view",
        costMillicents: 0,
        date: todayBucket(),
        viewerId: viewerId ?? null,
      },
    });
  } catch (err) {
    console.warn("[ads] view ledger insert failed:", err);
  }
}

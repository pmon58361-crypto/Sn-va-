import { prisma } from "@/lib/prisma";

// Ad selectors for the two placements. Server-side uniform random pick over
// active + in-window candidates; serving counts as one atomic impression.
// No third-party anything — selection, counting and redirect are all ours.

export type AdPlacement = "FEED" | "SIDEBAR";

export type ServedAd = {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
};

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
    },
  });
  if (candidates.length === 0) return null;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  // Serving = one impression. Atomic increment; failure to count must not
  // block the render (worst case an impression goes uncounted).
  try {
    await prisma.ad.update({
      where: { id: picked.id },
      data: { impressions: { increment: 1 } },
    });
  } catch (err) {
    console.warn("[ads] impression increment failed:", err);
  }
  return picked;
}

export function getFeedAd() {
  return pickAd("FEED");
}

export function getSidebarAd() {
  return pickAd("SIDEBAR");
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAdView } from "@/lib/ads";

export const dynamic = "force-dynamic";

// POST /api/ads/[id]/view — viewability beacon. The AdCard fires this once
// when the card actually spends time on screen (IntersectionObserver +
// dwell threshold client-side). Counts separately from served impressions:
// a serve is delivery, a view is attention. Displayed in admin, not billed
// (billing still follows served+CPC). Never fails the caller.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let viewerId: string | null = null;
  try {
    const body = (await _req.json().catch(() => ({}))) as {
      viewerId?: unknown;
    };
    // Self-reported: fine for a display metric, NEVER trusted for caps or
    // billing (those use server-side session ids on the serve path).
    if (typeof body.viewerId === "string" && body.viewerId.length < 64) {
      viewerId = body.viewerId;
    }
  } catch {
    // Body is optional; anonymous views still count.
  }
  const exists = await prisma.ad
    .findUnique({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!exists) return NextResponse.json({ ok: false }, { status: 404 });
  await recordAdView(id, viewerId);
  return NextResponse.json({ ok: true });
}

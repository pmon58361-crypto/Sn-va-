import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidAdWindow } from "@/lib/ads";

export const dynamic = "force-dynamic";

// GET /api/ads/[id]/click — the ONLY click path ads use. Verifies the ad is
// still active + in window (a paused-mid-flight click must not count), then
// atomically increments clicks and 302s to the target. No JS, no beacons,
// CSP-clean; works with the link rendered server-side.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ad = await prisma.ad.findUnique({
    where: { id },
    select: {
      targetUrl: true,
      active: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!ad || !isValidAdWindow(ad)) {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }

  // Click-time scheme gate (defense in depth: creation already requires
  // https, but legacy rows predate that check). An attacker-controlled
  // javascript:/data: target would turn our own domain into a phishing
  // redirector, so anything but http(s) bounces home.
  let target: URL;
  try {
    target = new URL(ad.targetUrl);
  } catch {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }

  try {
    await prisma.ad.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    });
  } catch (err) {
    // Never block the redirect on a counting failure.
    console.warn("[ads] click increment failed:", err);
  }

  return NextResponse.redirect(target.toString(), 302);
}

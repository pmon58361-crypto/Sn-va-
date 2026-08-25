import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { destroyAssets } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 500;

/**
 * Story expiry sweeper — STORAGE-ONLY cleanup. Expired story ROWS are
 * intentionally KEPT: they power the profile Archive (lib/stories keeps
 * expired rows by design). This job therefore only clears the Cloudinary
 * asset and nulls imageUrl, leaving caption/bg/history intact — the
 * archive renders those rows via its text/letter fallback.
 *
 * Vercel Cron hits this daily (see vercel.json) with
 * Authorization: Bearer $CRON_SECRET. Requires CRON_SECRET to be set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Sweeper not configured (missing CRON_SECRET)" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Photo stories in this batch get their assets destroyed first, then the
  // rows are kept but stripped of the (now-dead) URL.
  const expiredWithAssets = await prisma.story.findMany({
    where: { expiresAt: { lt: new Date() }, imageUrl: { not: null } },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: BATCH,
  });

  let cleared = 0;
  if (expiredWithAssets.length > 0) {
    const urls = await prisma.story.findMany({
      where: { id: { in: expiredWithAssets.map((s) => s.id) } },
      select: { imageUrl: true },
    });
    await destroyAssets(urls.map((s) => s.imageUrl));
    const res = await prisma.story.updateMany({
      where: { id: { in: expiredWithAssets.map((s) => s.id) } },
      data: { imageUrl: null },
    });
    cleared = res.count;
  }

  return NextResponse.json({
    assetsDestroyed: expiredWithAssets.length,
    rowsCleared: cleared,
    moreRemaining: expiredWithAssets.length === BATCH,
  });
}

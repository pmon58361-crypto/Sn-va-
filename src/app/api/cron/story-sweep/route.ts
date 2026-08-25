import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { destroyAssets } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 500;

/**
 * Story expiry sweeper. Stories expire after 24h, but nothing else destroys
 * their Cloudinary assets — manual/admin deletes cover only explicit removals.
 * Without this sweep every expired photo story leaks its asset permanently
 * against the free-tier storage quota.
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

  // Photo stories in this batch get their assets destroyed first, then all
  // expired rows (photo + text notes) are removed in one statement.
  const expiredWithAssets = await prisma.story.findMany({
    where: { expiresAt: { lt: new Date() }, imageUrl: { not: null } },
    select: { id: true, imageUrl: true },
    orderBy: { expiresAt: "asc" },
    take: BATCH,
  });

  if (expiredWithAssets.length > 0) {
    await destroyAssets(expiredWithAssets.map((s) => s.imageUrl));
  }

  const deleted = await prisma.story.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return NextResponse.json({
    assetsDestroyed: expiredWithAssets.length,
    rowsDeleted: deleted.count,
    moreRemaining: deleted.count === BATCH,
  });
}

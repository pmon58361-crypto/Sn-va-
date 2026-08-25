import { prisma } from "@/lib/prisma";

export const DAILY_UPLOAD_CAP = Number(process.env.DAILY_UPLOAD_CAP || 40);

/**
 * Daily per-user upload cap across ALL image surfaces — post images, story
 * photos, avatars, highlight covers. Free-tier insurance against a runaway
 * script or compromised account burning storage quota. Text notes create no
 * upload and must not consume the budget.
 *
 * Shared by /api/upload and story creation so no path bypasses the cap.
 */
export async function checkDailyUploadQuota(
  userId: string,
  additionalFiles = 0
): Promise<{ ok: boolean; used: number }> {
  const extra = Math.max(0, additionalFiles);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [imagesToday, storiesToday] = await Promise.all([
    prisma.postImage.count({
      where: {
        createdAt: { gte: startOfDay },
        post: { authorId: userId },
      },
    }),
    prisma.story.count({
      where: {
        authorId: userId,
        createdAt: { gte: startOfDay },
        imageUrl: { not: null },
      },
    }),
  ]);
  const used = imagesToday + storiesToday;
  return { ok: used + extra <= DAILY_UPLOAD_CAP, used };
}

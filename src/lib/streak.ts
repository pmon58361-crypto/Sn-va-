import { prisma } from "@/lib/prisma";

// Derived daily streak: consecutive days (UTC) ending today or yesterday with
// at least one REAL action by the user — post, comment, or reaction. Login
// sessions don't count (a streak you can earn by opening a tab is not a
// streak). Bounded to a 90-day scan; display caps there too.
export async function getStreak(
  userId: string
): Promise<{ current: number; activeToday: boolean }> {
  const DAY = 86_400_000;
  const since = new Date(Date.now() - 90 * DAY);
  const [posts, comments, reactions] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.reaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const days = new Set<string>();
  for (const row of [...posts, ...comments, ...reactions]) {
    days.add(row.createdAt.toISOString().slice(0, 10));
  }
  if (days.size === 0) return { current: 0, activeToday: false };

  const keyOf = (d: Date) => d.toISOString().slice(0, 10);
  // Today not yet active doesn't break the streak — the day isn't over.
  let cursor = new Date();
  if (!days.has(keyOf(cursor))) cursor = new Date(cursor.getTime() - DAY);

  let current = 0;
  while (days.has(keyOf(cursor)) && current < 90) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }

  return { current, activeToday: days.has(keyOf(new Date())) };
}

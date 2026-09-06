import { prisma } from "@/lib/prisma";

/** A challenge is live when it has no end date or the end is in the future. */
export function isChallengeLive(c: { endsAt: Date | null }) {
  return !c.endsAt || c.endsAt.getTime() > Date.now();
}

/** The single live challenge (earliest deadline first), or null. */
export async function getActiveChallenge() {
  const now = new Date();
  return prisma.challenge.findFirst({
    where: { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: { endsAt: "asc" },
    include: { _count: { select: { posts: true } } },
  });
}

export async function getChallenge(id: string) {
  return prisma.challenge.findUnique({
    where: { id },
    include: {
      _count: { select: { posts: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

import { prisma } from "@/lib/prisma";

// Active stories grouped by author, newest first. Expired stories are kept
// (they power the profile Archive) — only non-expired ones are returned.
// `meId` drives the seen/unseen ring state.
export async function getActiveStories(meId?: string | null) {
  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: new Date() },
      // Deactivated authors' stories drop off the rail (their own still
      // show to them — a signed-in viewer can't be deactivated).
      author: { deactivatedAt: null },
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, image: true } },
      views: meId
        ? { where: { userId: meId }, select: { id: true } }
        : false,
      _count: { select: { views: true } },
    },
  });

  type Group = {
    author: { id: string; name: string | null; image: string | null };
    items: {
      id: string;
      imageUrl: string | null;
      caption: string | null;
      bg: string | null;
      musicUrl: string | null;
      createdAt: Date;
      seen: boolean;
      isMine: boolean;
      viewCount: number;
    }[];
    hasUnseen: boolean;
  };

  const groups = new Map<string, Group>();

  for (const s of stories) {
    let g = groups.get(s.author.id);
    if (!g) {
      g = { author: s.author, items: [], hasUnseen: false };
      groups.set(s.author.id, g);
    }
    const seen = Array.isArray(s.views) ? s.views.length > 0 : false;
    if (!seen && s.authorId !== meId) g.hasUnseen = true;
    g.items.push({
      id: s.id,
      imageUrl: s.imageUrl,
      caption: s.caption,
      bg: s.bg,
      musicUrl: s.musicUrl,
      createdAt: s.createdAt,
      seen,
      isMine: s.authorId === meId,
      viewCount: s._count.views,
    });
  }

  // My story first (so I can add/view mine), then unseen authors, then rest.
  return Array.from(groups.values()).sort((a, b) => {
    const aMine = a.author.id === meId ? 1 : 0;
    const bMine = b.author.id === meId ? 1 : 0;
    if (aMine !== bMine) return bMine - aMine;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return 0;
  });
}

// The signed-in user's expired stories, newest first (profile Archive).
export async function getArchivedStories(meId: string) {
  return prisma.story.findMany({
    where: { authorId: meId, expiresAt: { lte: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

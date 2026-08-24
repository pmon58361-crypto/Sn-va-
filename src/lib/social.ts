import { prisma } from "@/lib/prisma";

// Per-user interaction state for rendering cards with correct
// like/dislike/bookmark states. Returns Sets of post ids.
export async function getUserPostState(meId?: string | null): Promise<{
  likedIds: Set<string>;
  dislikedIds: Set<string>;
  bookmarkedIds: Set<string>;
}> {
  if (!meId) {
    return {
      likedIds: new Set(),
      dislikedIds: new Set(),
      bookmarkedIds: new Set(),
    };
  }
  const [reactions, marks] = await Promise.all([
    prisma.reaction.findMany({
      where: { userId: meId },
      select: { postId: true, type: true },
    }),
    prisma.bookmark.findMany({ where: { userId: meId }, select: { postId: true } }),
  ]);

  const likedIds = new Set<string>();
  const dislikedIds = new Set<string>();
  for (const r of reactions) {
    if (r.type === "like") likedIds.add(r.postId);
    else if (r.type === "dislike") dislikedIds.add(r.postId);
  }
  return { likedIds, dislikedIds, bookmarkedIds: new Set(marks.map((m) => m.postId)) };
}

export async function getFollowStats(userId: string) {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

export async function isFollowing(meId?: string | null, targetId?: string) {
  if (!meId || !targetId || meId === targetId) return false;
  const f = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: meId, followingId: targetId } },
    select: { id: true },
  });
  return !!f;
}

// Posts the user has bookmarked, newest bookmark first.
export async function getBookmarkedPosts(meId: string) {
  const marks = await prisma.bookmark.findMany({
    where: { userId: meId },
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              location: true,
              createdAt: true,
            },
          },
          images: { select: { id: true, url: true, order: true }, orderBy: { order: "asc" } },
          reactions: { select: { id: true, type: true, userId: true } },
          _count: { select: { comments: true, applications: true, images: true } },
        },
      },
    },
  });
  return marks.map((m) => m.post);
}

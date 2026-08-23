import { prisma } from "@/lib/prisma";
import {
  AFFINITY_WINDOW_DAYS,
  buildPersonalContextFromRows,
  rankFeed,
  rotateFeed,
  type FeedSort,
} from "@/lib/feed";
import type { PostCategory } from "@/lib/types";

// Standard include shape so all post fetches return a consistent object.
const postInclude = {
  author: {
    select: { id: true, name: true, image: true, location: true },
  },
  images: { select: { id: true, url: true, order: true }, orderBy: { order: "asc" } },
  reactions: { select: { id: true, type: true, userId: true } },
  _count: { select: { comments: true, applications: true, images: true } },
} as const;

export function reactionCounts(reactions: { type: string }[] = []) {
  return {
    likes: reactions.filter((r) => r.type === "like").length,
    dislikes: reactions.filter((r) => r.type === "dislike").length,
  };
}

export type PostWithRelations = Awaited<
  ReturnType<typeof prisma.post.findFirst>
> & {
  author: { id: string; name: string | null; image: string | null; location: string | null } | null;
  images: { id: string; url: string; order: number }[];
  reactions: { id: string; type: string; userId: string }[];
  _count: { comments: number; applications: number; images: number };
  bookmarks?: { userId: string }[];
};

export async function getPost(id: string, viewerId?: string) {
  return prisma.post.findUnique({
    where: { id },
    include: {
      ...postInclude,
      ...(viewerId ? { bookmarks: { where: { userId: viewerId } } } : {}),
    },
  });
}

export async function getPosts({
  category,
  categories,
  authorId,
  authorIds,
  search,
  before,
  limit = 50,
  includeClosed = false,
  viewerId,
  sort = 'best',
  includeHidden = false,
  // Job-board filters (URL-param driven).
  types,
  location,
  hasBudget,
}: {
  category?: PostCategory;
  categories?: PostCategory[];
  authorId?: string;
  /** "Following"-style feeds: restrict to these authors (me + follows). */
  authorIds?: string[];
  search?: string;
  /** Chronological cursor for Load more: only posts older than this. */
  before?: Date;
  limit?: number;
  includeClosed?: boolean;
  viewerId?: string;
  sort?: FeedSort;
  /** Admin surfaces only - feeds never show hidden posts. */
  includeHidden?: boolean;
  /** Filter by the post's `type` field, e.g. ["freelance","full-time"]. */
  types?: string[];
  /** Exact match on the post's `location` field (e.g. "Remote"). */
  location?: string;
  /** Only posts that carry a budget. */
  hasBudget?: boolean;
} = {}) {
  const where: Record<string, unknown> = {};

  if (category) where.category = category;
  if (categories && categories.length) where.category = { in: categories };

  if (types && types.length) where.type = { in: types, mode: "insensitive" };
  if (location) where.location = { equals: location, mode: "insensitive" };
  if (hasBudget) where.budget = { not: null };

  if (authorId) where.authorId = authorId;
  else if (authorIds && authorIds.length) where.authorId = { in: authorIds };

  if (!includeClosed) where.status = "open";

  // Moderation: hidden posts stay out of every feed unless explicitly asked.
  if (!includeHidden) where.hidden = false;

  if (before) where.createdAt = { lt: before };

  if (search) {
    // mode:"insensitive" is required on PostgreSQL (SQLite was case-insensitive
    // by default; Postgres "contains" is case-sensitive without it).
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { tags: { contains: search, mode: "insensitive" } },
    ];
  }

  // Plain chronological feeds need exactly one query. Following circles and
  // cursor pages also skip the ranker: recency is the point of a following
  // feed, and ranking doesn't compose with createdAt cursors.
  if (sort !== "best" || before || (authorIds && authorIds.length > 0)) {
    return prisma.post.findMany({
      where,
      include: {
        ...postInclude,
        ...(viewerId ? { bookmarks: { where: { userId: viewerId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  // Ranked feed: over-fetch a pool so ranking has something to work with.
  // Every supporting query (personal affinity + 12h velocity) runs in the
  // SAME round trip as the pool — sequential awaits here used to cost 3+
  // extra Neon round trips per page load, which dominated latency.
  // The groupBy velocity filters by time only (not pool ids); extra map
  // entries are harmless because lookups are per-post-id.
  const poolTake = Math.max(limit * 4, 200);
  const since12 = new Date(Date.now() - 12 * 3_600_000);
  const sinceAffinity = new Date(
    Date.now() - AFFINITY_WINDOW_DAYS * 86_400_000
  );

  const [pool, myReactions, myComments, r12, c12] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        ...postInclude,
        ...(viewerId ? { bookmarks: { where: { userId: viewerId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: poolTake,
    }),
    viewerId
      ? prisma.reaction.findMany({
          where: { userId: viewerId, createdAt: { gte: sinceAffinity } },
          select: { post: { select: { authorId: true, tags: true } } },
        })
      : Promise.resolve([] as never[]),
    viewerId
      ? prisma.comment.findMany({
          where: { authorId: viewerId, createdAt: { gte: sinceAffinity } },
          select: { post: { select: { authorId: true, tags: true } } },
        })
      : Promise.resolve([] as never[]),
    prisma.reaction.groupBy({
      by: ["postId"],
      where: { createdAt: { gte: since12 } },
      _count: { _all: true },
    }),
    prisma.comment.groupBy({
      by: ["postId"],
      where: { createdAt: { gte: since12 } },
      _count: { _all: true },
    }),
  ]);

  const ctx = viewerId ? buildPersonalContextFromRows(myReactions, myComments, viewerId) : undefined;

  const recent12h = new Map<string, number>();
  for (const g of r12) recent12h.set(g.postId, g._count._all);
  for (const g of c12)
    recent12h.set(g.postId, (recent12h.get(g.postId) || 0) + g._count._all);

  return rotateFeed(
    rankFeed(pool, "best", new Date(), ctx, { recent12h, viewerId }),
    { viewerId }
  ).slice(0, limit);
}

export async function getComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Top tags across recent posts, ranked by frequency. Shared by the
// community topic-chip row and the RightSidebar trending list.
export async function getTopTags(limit = 8): Promise<[string, number][]> {
  const taggedPosts = await prisma.post.findMany({
    take: 100,
    where: { tags: { not: null }, status: "open", hidden: false },
    select: { tags: true },
  });
  const tagCounts = new Map<string, number>();
  for (const p of taggedPosts) {
    if (!p.tags) continue;
    for (const t of p.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}




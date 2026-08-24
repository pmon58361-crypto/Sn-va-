import { prisma } from "@/lib/prisma";
import {
  AFFINITY_WINDOW_DAYS,
  applyFeedbackToContext,
  applyInterestsToContext,
  buildPersonalContextFromRows,
  rankFeed,
  rotateFeed,
  type FeedSort,
} from "@/lib/feed";
import { parseTags } from "@/lib/utils";
import type { PostCategory } from "@/lib/types";

// Standard include shape so all post fetches return a consistent object.
const postInclude = {
  author: {
    select: { id: true, name: true, image: true, location: true, createdAt: true },
  },
  images: { select: { id: true, url: true, order: true }, orderBy: { order: "asc" } },
  reactions: { select: { id: true, type: true, userId: true } },
  _count: { select: { comments: true, applications: true, images: true } },
} as const;

// Viewer-scoped extras appended on top of postInclude for signed-in calls:
// their own bookmark state and their own feedback verdicts (the prompt
// suppresses itself on posts they already rated).
function viewerIncludes(viewerId?: string) {
  if (!viewerId) return {};
  return {
    bookmarks: { where: { userId: viewerId } },
    feedback: { where: { userId: viewerId }, select: { value: true } },
  };
}

export function reactionCounts(reactions: { type: string }[] = []) {
  return {
    likes: reactions.filter((r) => r.type === "like").length,
    dislikes: reactions.filter((r) => r.type === "dislike").length,
  };
}

export type PostWithRelations = Awaited<
  ReturnType<typeof prisma.post.findFirst>
> & {
  author: {
    id: string;
    name: string | null;
    image: string | null;
    location: string | null;
    createdAt: Date;
  } | null;
  images: { id: string; url: string; order: number }[];
  reactions: { id: string; type: string; userId: string }[];
  _count: { comments: number; applications: number; images: number };
  bookmarks?: { userId: string }[];
  feedback?: { value: string }[];
};

export async function getPost(id: string, viewerId?: string) {
  // findFirst (not findUnique) so the deactivated-author filter can compose.
  // A deactivated account's posts read as missing everywhere; the owner
  // can't hit this while deactivated (they read as signed out).
  return prisma.post.findFirst({
    where: { id, author: { is: { deactivatedAt: null } } },
    include: {
      ...postInclude,
      ...(viewerId ? viewerIncludes(viewerId) : {}),
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

  // Deactivated authors' posts stay out of every feed and listing.
  where.author = { is: { deactivatedAt: null } };

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
        ...(viewerId ? viewerIncludes(viewerId) : {}),
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

  const [pool, myReactions, myComments, myFeedback, mySettings, r12, c12] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        ...postInclude,
        ...(viewerId ? viewerIncludes(viewerId) : {}),
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
    viewerId
      ? prisma.postFeedback.findMany({
          where: { userId: viewerId },
          select: {
            value: true,
            postId: true,
            post: { select: { authorId: true, tags: true } },
          },
          take: 300,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as never[]),
    // Picker picks: one extra PK lookup folded into the same round trip.
    viewerId
      ? prisma.settings.findUnique({
          where: { userId: viewerId },
          select: { interests: true },
        })
      : Promise.resolve(null),
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

  const ctx =
    viewerId && pool.length
      ? buildPersonalContextFromRows(myReactions, myComments, viewerId)
      : undefined;
  if (ctx) {
    applyFeedbackToContext(ctx, myFeedback);
    // Explicit picks from the interests picker join the same context —
    // they carry the strongest, never-decaying weight the ranker has.
    if (mySettings?.interests) {
      applyInterestsToContext(ctx, parseTags(mySettings.interests));
    }
  }

  // Posts the viewer explicitly said "not interested" on leave the feed
  // entirely — a hard exclusion, stronger than any score demotion.
  const notInterestedIds = new Set(
    myFeedback
      .filter((f) => f.value === "not_interested")
      .map((f) => f.postId)
  );
  const eligiblePool =
    notInterestedIds.size > 0
      ? pool.filter((p) => !notInterestedIds.has(p.id))
      : pool;

  const recent12h = new Map<string, number>();
  for (const g of r12) recent12h.set(g.postId, g._count._all);
  for (const g of c12)
    recent12h.set(g.postId, (recent12h.get(g.postId) || 0) + g._count._all);

  return rotateFeed(
    rankFeed(eligiblePool, "best", new Date(), ctx, { recent12h, viewerId }),
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




// -- Creator dashboard (real counts only) -------------------------------------

export type CreatorPostRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: Date;
  likes: number;
  comments: number;
  applications: number;
};

export type CreatorDashboard = {
  totals: {
    posts: number;
    followers: number;
    likesReceived: number;
    commentsReceived: number;
    bookmarksReceived: number;
    applicationsReceived: number;
  };
  postsByCategory: { category: string; count: number }[];
  recentPosts: CreatorPostRow[];
};

export async function getCreatorDashboard(meId: string): Promise<CreatorDashboard> {
  const [posts, followers, likes, comments, bookmarks, applications, byCategory, recent] =
    await Promise.all([
      prisma.post.count({ where: { authorId: meId, hidden: false } }),
      prisma.follow.count({ where: { followingId: meId } }),
      prisma.reaction.count({ where: { type: "like", post: { authorId: meId } } }),
      prisma.comment.count({ where: { post: { authorId: meId } } }),
      prisma.bookmark.count({ where: { post: { authorId: meId } } }),
      prisma.application.count({ where: { post: { authorId: meId } } }),
      prisma.post.groupBy({
        by: ["category"],
        where: { authorId: meId, hidden: false },
        _count: { _all: true },
      }),
      prisma.post.findMany({
        where: { authorId: meId, hidden: false },
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          createdAt: true,
          reactions: { select: { type: true }, where: { type: "like" } },
          _count: { select: { comments: true, applications: true } },
        },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      }),
    ]);

  return {
    totals: {
      posts,
      followers,
      likesReceived: likes,
      commentsReceived: comments,
      bookmarksReceived: bookmarks,
      applicationsReceived: applications,
    },
    postsByCategory: byCategory.map((g) => ({ category: g.category, count: g._count._all })),
    recentPosts: recent.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      status: p.status,
      createdAt: p.createdAt,
      likes: p.reactions.length,
      comments: p._count.comments,
      applications: p._count.applications,
    })),
  };
}

// -- Creator analytics (YouTube-Studio-style, real events only) ---------------

export type AnalyticsDaily = {
  date: string; // YYYY-MM-DD
  likes: number;
  comments: number;
  applications: number;
  bookmarks: number;
  followers: number;
};

export type EventTotals = {
  likes: number;
  comments: number;
  applications: number;
  bookmarks: number;
  followers: number;
};

export type CreatorAnalytics = {
  rangeLabel: string;
  stepDays: number;
  daily: AnalyticsDaily[];
  totals: EventTotals;
  prevTotals: EventTotals;
  last48h: EventTotals;
};

function zeroTotals(): EventTotals {
  return { likes: 0, comments: 0, applications: 0, bookmarks: 0, followers: 0 };
}

function addTo(t: EventTotals, k: keyof EventTotals, n = 1) {
  t[k] += n;
}

// Pulls engagement events aimed at this creator's content and buckets them
// client-computably. Fixed ranges only scan their own window plus the
// equally-sized previous period (needed for delta comparison); all-time
// still reads everything. Revisit further if volumes ever demand it.
export async function getCreatorAnalytics(
  meId: string,
  days: number // 7 | 28 | 0 = all time
): Promise<CreatorAnalytics> {
  const now = Date.now();
  const DAY = 86_400_000;
  // start = now - days*DAY, prevStart = start - days*DAY — one bound covers both.
  const since = days > 0 ? new Date(now - days * DAY * 2) : null;
  const rangeWhere = since ? { createdAt: { gte: since } } : {};

  const [likes, comments, applications, bookmarks, follows] = await Promise.all([
    prisma.reaction.findMany({
      where: { type: "like", post: { authorId: meId }, ...rangeWhere },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.comment.findMany({
      where: { post: { authorId: meId }, ...rangeWhere },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.application.findMany({
      where: { post: { authorId: meId }, ...rangeWhere },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bookmark.findMany({
      where: { post: { authorId: meId }, ...rangeWhere },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.follow.findMany({
      where: { followingId: meId, ...rangeWhere },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type Ev = { t: number; kind: keyof EventTotals };
  const events: Ev[] = [
    ...likes.map((e) => ({ t: e.createdAt.getTime(), kind: "likes" as const })),
    ...comments.map((e) => ({ t: e.createdAt.getTime(), kind: "comments" as const })),
    ...applications.map((e) => ({ t: e.createdAt.getTime(), kind: "applications" as const })),
    ...bookmarks.map((e) => ({ t: e.createdAt.getTime(), kind: "bookmarks" as const })),
    ...follows.map((e) => ({ t: e.createdAt.getTime(), kind: "followers" as const })),
  ].sort((a, b) => a.t - b.t);

  let start: number;
  if (days > 0) {
    start = now - days * DAY;
  } else {
    start = events.length > 0 ? events[0].t : now;
    // Align all-time start to midnight so day 0 isn't a sliver.
    const d = new Date(start);
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  const spanDays = Math.max(1, Math.ceil((now - start) / DAY));
  const stepDays = spanDays <= 31 ? 1 : spanDays <= 180 ? 7 : 30;
  const bucketCount = Math.ceil(spanDays / stepDays);

  const daily: AnalyticsDaily[] = Array.from({ length: bucketCount }, (_, i) => ({
    date: new Date(start + i * stepDays * DAY).toISOString().slice(0, 10),
    likes: 0,
    comments: 0,
    applications: 0,
    bookmarks: 0,
    followers: 0,
  }));

  const totals = zeroTotals();
  const prevTotals = zeroTotals();
  const last48h = zeroTotals();
  const prevStart = days > 0 ? start - days * DAY : null;

  for (const e of events) {
    if (e.t >= now - 48 * 3600_000) addTo(last48h, e.kind);
    if (e.t >= start) {
      const idx = Math.min(bucketCount - 1, Math.floor((e.t - start) / (stepDays * DAY)));
      addTo(daily[idx], e.kind);
      addTo(totals, e.kind);
    } else if (prevStart !== null && e.t >= prevStart) {
      addTo(prevTotals, e.kind);
    }
  }

  return {
    rangeLabel: days > 0 ? `Last ${days} days` : "Since the beginning",
    stepDays,
    daily,
    totals,
    prevTotals,
    last48h,
  };
}

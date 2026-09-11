import { prisma } from "@/lib/prisma";
import {
  AFFINITY_WINDOW_DAYS,
  applyFeedbackToContext,
  applyInterestsToContext,
  buildPersonalContextFromRows,
  feedScore,
  rotateFeed,
  scorePool,
  type FeedSort,
} from "@/lib/feed";
import { parseTags } from "@/lib/utils";
import type { PostCategory } from "@/lib/types";

// Standard include shape so all post fetches return a consistent object.
export const postInclude = {
  author: {
    select: { id: true, name: true, image: true, location: true, createdAt: true },
  },
  images: { select: { id: true, url: true, order: true }, orderBy: { order: "asc" } },
  reactions: { select: { id: true, type: true, userId: true } },
  // Attached poll with its votes (optionId-light rows) so cards render real
  // tallies and the viewer's own choice without extra round trips.
  polls: {
    include: { votes: { select: { optionId: true, userId: true } } },
  },
  _count: { select: { comments: true, applications: true, images: true } },
} as const;

// "From the archives" — one quality COMMUNITY post older than 30 days that
// isn't already on the page, picked uniformly at random. Returns null when
// the archive is empty (launch weeks) — callers hide the slot entirely.
export async function getArchivedCommunityPost(excludeIds: string[]) {
  const where = {
    category: "COMMUNITY" as const,
    status: "open",
    hidden: false,
    groupId: null,
    createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) },
    reactions: { some: {} },
    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
  };
  const count = await prisma.post.count({ where });
  if (count === 0) return null;
  const [row] = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1,
    skip: Math.floor(Math.random() * count),
    include: postInclude,
  });
  return row ?? null;
}

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
  group?: { slug: string; name: string; visibility: string } | null;
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
  groupId,
  challengeId,
  excludeGroupPosts,
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
  /** Group feed opt-in — when absent, private-group posts stay out. */
  groupId?: string;
  /** For-You feeds: group posts live in groups, never in the main feed. */
  excludeGroupPosts?: boolean;
  /** Challenge entries opt-in — private-group entries stay out (no leaks). */
  challengeId?: string;
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

  // Group scoping: group pages filter by groupId; every other surface hides
  // PRIVATE-group posts while public-group posts flow into main feeds
  // (they carry a group badge via postInclude).
  if (groupId) where.groupId = groupId;
  else where.NOT = [{ group: { visibility: "private" } }];

  // Group posts live in groups: For-You/Following never show them (they
  // have their own page, chips, and notifications). Search still finds them.
  if (excludeGroupPosts) where.groupId = null;

  if (challengeId) where.challengeId = challengeId;

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

  const [pool, myReactions, myComments, myFeedback, mySettings, myFollows, r12, c12] = await Promise.all([
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
    // Relationship signal for candidate prioritization (stage 1): a follow
    // counts as FOLLOW_AFFINITY interaction-equivalents in the ranker.
    viewerId
      ? prisma.follow.findMany({
          where: { followerId: viewerId },
          select: { followingId: true },
        })
      : Promise.resolve([] as { followingId: string }[]),
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
      ? buildPersonalContextFromRows(
          myReactions,
          myComments,
          viewerId,
          myFollows.map((f) => f.followingId)
        )
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

  // One clock for ranking + rotation so scores agree everywhere.
  // scorePool is computed once and shared: rotation jitters these exact
  // numbers, so personalization survives the reshuffle (stage 6).
  const now = new Date();
  const signals = { recent12h, viewerId };
  const scores = scorePool(eligiblePool, now, ctx, signals);
  const ranked = [...eligiblePool].sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
  );
  return rotateFeed(ranked, {
    viewerId,
    limit,
    scoreOf: (p) => scores.get(p.id) ?? feedScore(p, now),
    affinityOf: (authorId) => ctx?.authorAffinity.get(authorId) ?? 0,
  }).slice(0, limit);
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
  saves: number;
  /** Distinct accounts engaged (likes/comments/saves/applications). */
  reach: number;
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
  week: { posts: number; commentsReceived: number };
  goals: { posts: number; replies: number };
};

// Stored weekly-goal overrides (Settings.goals JSON) sanitized into shape.
// Mirrors dashboard-insights.resolveTargets without the import (keeps the
// query layer dependency-free); both clamp to the same 1..50 range.
function parseGoalTargets(stored: unknown): { posts: number; replies: number } {
  const o =
    stored !== null && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 50
      ? Math.trunc(v)
      : fallback;
  return { posts: num(o.posts, 3), replies: num(o.replies, 5) };
}

export async function getCreatorDashboard(meId: string): Promise<CreatorDashboard> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [posts, followers, likes, comments, bookmarks, applications, byCategory, recent, postsThisWeek, commentsThisWeek, goalSettings] =
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
          reactions: { select: { type: true, userId: true }, where: { type: "like" } },
          comments: { select: { authorId: true }, take: 250 },
          _count: { select: { comments: true, applications: true, bookmarks: true } },
          bookmarks: { select: { userId: true } },
          applications: { select: { userId: true } },
        },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      }),
      // Weekly-goals inputs (rolling 7 days): my output + replies earned.
      prisma.post.count({ where: { authorId: meId, hidden: false, createdAt: { gte: weekAgo } } }),
      prisma.comment.count({ where: { post: { authorId: meId }, createdAt: { gte: weekAgo } } }),
      prisma.settings.findUnique({ where: { userId: meId }, select: { goals: true } }),
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
    week: { posts: postsThisWeek, commentsReceived: commentsThisWeek },
    goals: parseGoalTargets(goalSettings?.goals),
    recentPosts: recent.map((p) => {
      const likeUserIds = p.reactions.map((r) => r.userId);
      const seen = new Set<string>([
        ...likeUserIds,
        ...p.comments.map((c) => c.authorId),
        ...p.bookmarks.map((b) => b.userId),
        ...p.applications.map((a) => a.userId),
      ]);
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        createdAt: p.createdAt,
        likes: p.reactions.length,
        comments: p._count.comments,
        applications: p._count.applications,
        saves: p._count.bookmarks,
        reach: seen.size,
      };
    }),
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
  // Best-time-to-post: content engagement (likes/comments/applications/
  // bookmarks on my posts) aggregated by local hour and weekday, over the
  // same window as the rest. Zero extra queries — folded from events.
  byHour: number[];
  byWeekday: number[];
  // Top tags across ALL my posts: engagement per topic, for precise
  // "what should I post more of" answers.
  topTags: { tag: string; posts: number; likes: number; comments: number; saves: number }[];
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

  const [likes, comments, applications, bookmarks, follows, tagPosts] = await Promise.all([
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
    // Tag table source: my posts with topics + engagement. One extra read,
    // small rows (no content bodies), same wave as everything else.
    prisma.post.findMany({
      where: { authorId: meId, hidden: false },
      select: {
        tags: true,
        reactions: { select: { type: true }, where: { type: "like" } },
        _count: { select: { comments: true, bookmarks: true } },
      },
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

  // Best-time-to-post + top tags, folded from data already in hand.
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);

  for (const e of events) {
    if (e.t >= now - 48 * 3600_000) addTo(last48h, e.kind);
    if (e.t >= start) {
      const idx = Math.min(bucketCount - 1, Math.floor((e.t - start) / (stepDays * DAY)));
      addTo(daily[idx], e.kind);
      addTo(totals, e.kind);
      // Follows aren't content timing — only content engagement (likes,
      // comments, applications, saves) teaches posting hours.
      if (e.kind !== "followers") {
        const d = new Date(e.t);
        byHour[d.getHours()] += 1;
        byWeekday[d.getDay()] += 1;
      }
    } else if (prevStart !== null && e.t >= prevStart) {
      addTo(prevTotals, e.kind);
    }
  }

  const tagMap = new Map<string, { posts: number; likes: number; comments: number; saves: number }>();
  for (const p of tagPosts) {
    const tags = (p.tags || "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!tags.length) continue;
    for (const t of new Set(tags)) {
      const row = tagMap.get(t) ?? { posts: 0, likes: 0, comments: 0, saves: 0 };
      row.posts += 1;
      row.likes += p.reactions.length;
      row.comments += p._count.comments;
      row.saves += p._count.bookmarks;
      tagMap.set(t, row);
    }
  }
  const topTags = [...tagMap.entries()]
    .map(([tag, r]) => ({ tag, ...r }))
    .sort((a, b) => b.likes + b.comments * 2 + b.saves * 2 - (a.likes + a.comments * 2 + a.saves * 2))
    .slice(0, 8);

  return {
    rangeLabel: days > 0 ? `Last ${days} days` : "Since the beginning",
    stepDays,
    daily,
    totals,
    prevTotals,
    last48h,
    byHour,
    byWeekday,
    topTags,
  };
}

// -- Audience + stories + hiring analytics (same YouTube-Studio spirit) ----

export type StoryStatRow = {
  id: string;
  caption: string | null;
  createdAt: Date;
  expired: boolean;
  views: number;
};

export type StoryAnalytics = {
  stories: number;
  views: number;
  viewers: number;
  avgViews: number;
  recent: StoryStatRow[];
};

export async function getStoryAnalytics(meId: string): Promise<StoryAnalytics> {
  const stories = await prisma.story.findMany({
    where: { authorId: meId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      caption: true,
      createdAt: true,
      expiresAt: true,
      views: { select: { userId: true } },
    },
  });
  const totalViews = await prisma.storyView.count({
    where: { story: { authorId: meId } },
  });
  const viewers = new Set<string>();
  for (const s of stories) for (const v of s.views) viewers.add(v.userId);
  const now = Date.now();
  return {
    stories: stories.length,
    views: totalViews,
    viewers: viewers.size,
    avgViews: stories.length > 0 ? Math.round((totalViews / stories.length) * 10) / 10 : 0,
    recent: stories.slice(0, 8).map((s) => ({
      id: s.id,
      caption: s.caption,
      createdAt: s.createdAt,
      expired: s.expiresAt.getTime() < now,
      views: s.views.length,
    })),
  };
}

export type FollowerAnalytics = {
  total: number;
  gained: number;
  mutuals: number;
  recent: { id: string; name: string | null; image: string | null }[];
};

export async function getFollowerAnalytics(
  meId: string,
  days: number
): Promise<FollowerAnalytics> {
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const [total, gainedRows, recentRows, myFollowing] = await Promise.all([
    prisma.follow.count({ where: { followingId: meId } }),
    prisma.follow.findMany({
      where: { followingId: meId, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { followerId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: meId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        follower: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.follow.findMany({
      where: { followerId: meId },
      select: { followingId: true },
    }),
  ]);
  const following = new Set(myFollowing.map((f) => f.followingId));
  return {
    total,
    gained: gainedRows.length,
    mutuals: gainedRows.filter((g) => following.has(g.followerId)).length,
    recent: recentRows.map((r) => r.follower),
  };
}

export type FunnelRow = {
  id: string;
  title: string;
  createdAt: Date;
  applicants: number;
  accepted: number;
  rejected: number;
  firstReplyHours: number | null;
};

export async function getJobsFunnel(meId: string): Promise<FunnelRow[]> {
  const listings = await prisma.post.findMany({
    where: { authorId: meId, category: "JOB_LISTING", hidden: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      createdAt: true,
      applications: { select: { status: true, createdAt: true } },
    },
  });
  return listings.map((p) => {
    const first = p.applications.reduce<number | null>(
      (min, a) => (min === null || a.createdAt.getTime() < min ? a.createdAt.getTime() : min),
      null
    );
    return {
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      applicants: p.applications.length,
      accepted: p.applications.filter((a) => a.status === "accepted").length,
      rejected: p.applications.filter((a) => a.status === "rejected").length,
      firstReplyHours:
        first === null
          ? null
          : Math.round(((first - p.createdAt.getTime()) / 3_600_000) * 10) / 10,
    };
  });
}

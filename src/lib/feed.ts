import { prisma } from "@/lib/prisma";
import type { PostWithRelations } from "@/lib/queries";

/**
 * Snívať feed ranking — Hacker-News gravity, adapted for a
 * creator + jobs community.
 *
 *   score = points / (hoursAge + 2) ^ GRAVITY
 *
 * points = likes*3 + comments*4 + applications*6 - dislikes*2 + freshBoost
 *
 * Rationale for the weights:
 *  - applications (6) outweigh comments (4): a hired gig is the strongest
 *    signal the platform can produce.
 *  - comments (4) beat likes (3): discussion > passive approval.
 *  - dislikes subtract, but softly — a controversial post still ranks
 *    above silence.
 *  - freshBoost gives every new post a short guaranteed window on the feed,
 *    otherwise zero-engagement posts would be invisible forever.
 *
 * GRAVITY (1.5) controls how fast posts decay. HN uses 1.8; we are gentler
 * because community volume is low and good content should surface for days,
 * not hours.
 */

const GRAVITY = 1.5;

const W_LIKE = 3;
const W_COMMENT = 4;
const W_APPLICATION = 6;
const W_DISLIKE = 2;

function freshBoostHours(createdAt: Date, now: Date): number {
  const h = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (h < 2) return 8; // prime of life
  if (h < 6) return 4; // still warm
  if (h < 24) return 1; // gentle tail
  return 0;
}

/**
 * Facebook-style personalization layer.
 *
 * Approximates FB's "affinity score": how much THIS viewer has interacted
 * with THIS author / THESE topics recently. Interactions = reactions +
 * comments over the last 90 days. Self-interactions are ignored.
 *
 * Multiplier applied to the base gravity score:
 *   x(1 + 0.35 * authorAffinity + 0.25 * tagAffinity)
 *   authorAffinity = min(1, interactions_with_author / 5)
 *   tagAffinity    = min(1, strongest_matching_tag_count / 3)
 */
export type PersonalContext = {
  authorAffinity: Map<string, number>;
  tagAffinity: Map<string, number>;
};

export const AFFINITY_WINDOW_DAYS = 90;

// Explicit "interested"/"not_interested" verdicts from the in-feed prompt.
// These are the strongest signals the viewer can give — worth more than
// any implicit reaction. interested → +2 toward author/tag affinity,
// not_interested → −3 (counts go negative; personalMultiplier demotes).
export type FeedbackRow = {
  value: string;
  post: { authorId: string | null; tags: string | null } | null;
};

const W_FEEDBACK_INTERESTED = 2;
const W_FEEDBACK_NOT_INTERESTED = -3;

export function applyFeedbackToContext(
  ctx: PersonalContext,
  feedbacks: FeedbackRow[]
): void {
  for (const f of feedbacks) {
    if (!f.post) continue;
    const weight =
      f.value === "interested"
        ? W_FEEDBACK_INTERESTED
        : f.value === "not_interested"
          ? W_FEEDBACK_NOT_INTERESTED
          : 0;
    if (!weight) continue;
    if (f.post.authorId) {
      ctx.authorAffinity.set(
        f.post.authorId,
        (ctx.authorAffinity.get(f.post.authorId) || 0) + weight
      );
    }
    for (const raw of (f.post.tags || "").split(",")) {
      const t = raw.trim().toLowerCase();
      if (!t) continue;
      ctx.tagAffinity.set(t, (ctx.tagAffinity.get(t) || 0) + weight);
    }
  }
}

export async function buildPersonalContext(
  viewerId: string
): Promise<PersonalContext> {
  const since = new Date(Date.now() - AFFINITY_WINDOW_DAYS * 86_400_000);
  const [reactions, comments] = await Promise.all([
    prisma.reaction.findMany({
      where: { userId: viewerId, createdAt: { gte: since } },
      select: { post: { select: { authorId: true, tags: true } } },
    }),
    prisma.comment.findMany({
      where: { authorId: viewerId, createdAt: { gte: since } },
      select: { post: { select: { authorId: true, tags: true } } },
    }),
  ]);
  return buildPersonalContextFromRows(reactions, comments, viewerId);
}

// Same aggregation as buildPersonalContext but over rows the caller already
// fetched — lets getPosts fold affinity into its single parallel query wave.
export function buildPersonalContextFromRows(
  reactions: { post: { authorId: string | null; tags: string | null } | null }[],
  comments: { post: { authorId: string | null; tags: string | null } | null }[],
  viewerId: string
): PersonalContext {
  const authors = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const p of [
    ...reactions.map((r) => r.post),
    ...comments.map((c) => c.post),
  ]) {
    if (!p) continue;
    if (p.authorId && p.authorId !== viewerId) {
      authors.set(p.authorId, (authors.get(p.authorId) || 0) + 1);
    }
    for (const raw of (p.tags || "").split(",")) {
      const t = raw.trim().toLowerCase();
      if (t) tags.set(t, (tags.get(t) || 0) + 1);
    }
  }
  return { authorAffinity: authors, tagAffinity: tags };
}

function personalMultiplier(
  post: PostWithRelations,
  ctx?: PersonalContext
): number {
  if (!ctx) return 1;
  const authorId =
    (post as unknown as { authorId?: string }).authorId ??
    (post as unknown as { author?: { id?: string } }).author?.id ??
    "";
  const a = Math.min(1, (ctx.authorAffinity.get(authorId) || 0) / 5);
  const postTags = ((post as unknown as { tags?: string }).tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  let strongest = 0;
  for (const t of postTags) {
    strongest = Math.max(strongest, ctx.tagAffinity.get(t) || 0);
  }
  const tagA = Math.min(1, strongest / 3);

  // Explicit negative feedback on this author or topic demotes hard —
  // the viewer literally said "less like this". Positive verdicts already
  // flow through the affinity counts above.
  const authorNegative = (ctx.authorAffinity.get(authorId) || 0) < 0;
  let anyTagNegative = false;
  for (const t of postTags) {
    if ((ctx.tagAffinity.get(t) || 0) < 0) {
      anyTagNegative = true;
      break;
    }
  }
  const negativeFactor = authorNegative || anyTagNegative ? 0.45 : 1;

  return (1 + 0.35 * a + 0.25 * tagA) * negativeFactor;
}

export function feedScore(post: PostWithRelations, now: Date = new Date()): number {
  const reactions = (post.reactions ?? []) as { type: string }[];
  const likes = reactions.filter((r) => r.type === "like").length;
  const dislikes = reactions.filter((r) => r.type === "dislike").length;
  const comments = post._count?.comments ?? 0;
  const applications = post._count?.applications ?? 0;

  const points =
    likes * W_LIKE +
    comments * W_COMMENT +
    applications * W_APPLICATION -
    dislikes * W_DISLIKE +
    freshBoostHours(post.createdAt, now);

  const hoursAge =
    Math.max(0, (now.getTime() - post.createdAt.getTime()) / 3_600_000);

  // +2 in the denominator keeps division sane for brand-new posts.
  return points / Math.pow(hoursAge + 2, GRAVITY);
}

export type FeedSort = "best" | "new";

/**
 * Rank a pool of posts. For "best" we expect the caller to have over-fetched
 * (a wider pool than the final page), so gravity has something to work with.
 */
/**
 * Advanced ranking signals.
 * recent12h: interactions (reactions+comments) per postId in the last 12h,
 * used for velocity-based hotness — a post gaining engagement FAST outranks
 * the same total spread across days. This is Twitter/FB "acceleration".
 */
export type EngagementSignals = {
  recent12h: Map<string, number>;
  viewerId?: string;
};

export function rankFeed<T extends PostWithRelations>(
  posts: T[],
  sort: FeedSort = "best",
  now: Date = new Date(),
  ctx?: PersonalContext,
  signals?: EngagementSignals
): T[] {
  if (sort === "new") {
    return [...posts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  const scored = posts.map((p) => {
    let s = feedScore(p, now) * personalMultiplier(p, ctx);

    // HOTNESS — acceleration up to ×2
    const recent = signals?.recent12h.get(p.id) ?? 0;
    if (recent > 0) {
      const hoursOld = Math.max(
        1,
        (now.getTime() - p.createdAt.getTime()) / 3_600_000
      );
      s *= Math.min(2, 1 + recent / Math.max(2, hoursOld) / 2);
    }

    // SEEN DEMOTION — already-consumed content sinks (×0.55)
    if (signals?.viewerId) {
      const reacted = ((p.reactions ?? []) as { userId: string }[]).some(
        (r) => r.userId === signals.viewerId
      );
      if (reacted) s *= 0.55;
    }

    // DISLIKE DAMPING — soft quality control
    const rs = (p.reactions ?? []) as { type: string }[];
    const likes = rs.filter((r) => r.type === "like").length;
    const dislikes = rs.filter((r) => r.type === "dislike").length;
    s /= 1 + (dislikes / (likes + 1)) * 1.5;

    // QUIET PENALTY — hearts but no discussion is weaker signal
    if (likes >= 3 && (p._count?.comments ?? 0) === 0) s *= 0.9;

    return { p, s };
  });

  return scored.sort((a, b) => b.s - a.s).map((x) => x.p);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function currentBucket(bucketHours = 1): number {
  return Math.floor(Date.now() / (bucketHours * 3_600_000));
}

/**
 * Refresh rotation — the TikTok/Facebook trick.
 *
 * A pure ranking is deterministic: same scores, same order forever. Users
 * experience that as a dead feed. Three motion sources fix it:
 *
 * 1. HOURLY JITTER — every post's score is multiplied by a stable-but-
 *    rotating factor seeded from (viewerId + hourBucket + postId). The feed
 *    reshuffles a little every hour even with zero engagement changes.
 * 2. EXPLORATION — two older posts (7+ days old, ranked outside the top 10)
 *    are re-surfaced at slots ~3 and ~8 by the hourly seed. FB's
 *    "resurfaced memories" / TikTok's out-of-network slot.
 * 3. AUTHOR SPREAD — no author ever appears three times back-to-back.
 */
export function rotateFeed<T extends PostWithRelations>(
  ranked: T[],
  opts: { viewerId?: string; bucketHours?: number } = {}
): T[] {
  const now = new Date();
  const bucket = currentBucket(opts.bucketHours ?? 1);
  const seedKey = `${opts.viewerId ?? "anon"}:${bucket}`;

  // 1) jittered resort (±12% on the gravity score), stable within the hour
  const jittered = ranked
    .map((p, i) => ({
      p,
      j:
        feedScore(p, now) *
        (0.88 + 0.24 * hashStr(`${seedKey}:${p.id}:${i}`)),
    }))
    .sort((a, b) => b.j - a.j)
    .map((x) => x.p);

  // 2) exploration splice
  const weekAgo = Date.now() - 7 * 86_400_000;
  const candidates = jittered
    .slice(10)
    .filter((p) => p.createdAt.getTime() < weekAgo);
  const slots: Array<{ at: number; post: T | null }> = [
    { at: 3, post: null },
    { at: 8, post: null },
  ];
  const usedIdx = new Set<number>();
  for (const slot of slots) {
    if (!candidates.length) break;
    let idx = Math.floor(
      hashStr(`${seedKey}:explore:${slot.at}`) * candidates.length
    );
    while (usedIdx.has(idx) && usedIdx.size < candidates.length) {
      idx = (idx + 1) % candidates.length;
    }
    usedIdx.add(idx);
    slot.post = candidates[idx];
  }

  const mixed: T[] = [];
  let cursor = 0;
  for (let i = 0; mixed.length < jittered.length + slots.filter((s) => s.post).length; i++) {
    const slot = slots.find((s) => s.at === i && s.post);
    if (slot?.post) {
      mixed.push(slot.post);
      continue;
    }
    if (cursor < jittered.length) mixed.push(jittered[cursor++]);
  }

  // 3) author spread — never the same author 3 times in a row
  const authorOf = (p: T) =>
    (p as unknown as { authorId?: string }).authorId ??
    (p as unknown as { author?: { id?: string } }).author?.id ??
    "?";
  const spread: T[] = [];
  const rest = [...mixed];
  while (rest.length) {
    const lastTwo = spread.slice(-2).map(authorOf);
    const blocked =
      lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null;
    let idx = rest.findIndex((p) => !blocked || authorOf(p) !== blocked);
    if (idx === -1) idx = 0;
    spread.push(rest.splice(idx, 1)[0]);
  }

  return spread;
}

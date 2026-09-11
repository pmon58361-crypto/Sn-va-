import { prisma } from "@/lib/prisma";
import type { PostWithRelations } from "@/lib/queries";

/**
 * Snívať feed ranking — Instagram-principled pipeline, adapted for a
 * creator + jobs community (discovery of useful people, ideas, projects,
 * skills, opportunities, discussions — never raw-like farming).
 *
 * Stages (mirroring established recommender architecture):
 *   1. CANDIDATE GENERATION (queries.ts getPosts) — over-fetch a recent pool
 *      (4× page, ≥200) with hard guards (hidden, deactivated, private-group,
 *      explicit not-interested exclusion). One wave also fetches affinity
 *      rows, follows, feedback, interests and 12h velocity.
 *   2. FEATURE COLLECTION (extractFeatures) — per (viewer, post): public
 *      counts, velocity, author/tag affinity, explicit verdicts, follow
 *      relationship, recency, quality, controversy, discussability.
 *   3. PREDICTION (predictPropensities) — P(action | viewer, post) per
 *      outcome (read/like/comment/save/share/profile-visit/negative/skip).
 *      Heuristic sub-models today; each is a named seam a learned model can
 *      replace without touching ranking.
 *   4. UTILITY (combineUtility + calibrateUtility) — value-weighted sum
 *      (meaningful interaction ≫ vanity), self-calibrated around the pool
 *      median so an average post scores ×1 whatever the absolute numbers.
 *   5. RANKING (finalScore/scorePool) — public gravity prior × calibrated
 *      utility × policy layers (explicit prefs, negative guard, new-voice
 *      probe, hotness, consumed-content demotions, dislike damping).
 *   6. DIVERSIFICATION (rotateFeed spread) — no 3-in-a-row same
 *      author/category/dominant-tag, plus a per-author page quota.
 *   7. EXPLORATION (rotateFeed slots) — old gems + unfamiliar high-potential
 *      posts at fixed slots, seeded deterministically per user/hour.
 *   8. FEEDBACK LOOP — reactions/comments/feedback/follows rewrite affinity
 *      (buildPersonalContext*), so repeated behavior compounds into taste.
 *
 * Base public rate — Hacker-News gravity, adapted for a creator + jobs
 * community.
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
  // Smooth exponential decay — the old 8/4/1/0 steps created visible rank
  // jumps at the 2h/6h/24h boundaries (posts teleporting past each other
  // with zero engagement change). Same magnitudes, no cliffs:
  // newborn ≈ 10, 2h ≈ 7.8, 6h ≈ 4.7, 24h ≈ 0.5.
  const h = Math.max(
    0,
    (now.getTime() - createdAt.getTime()) / 3_600_000
  );
  return 10 * Math.exp(-h / 8);
}

/**
 * Facebook-style personalization layer.
 *
 * Approximates FB's "affinity score": how much THIS viewer has interacted
 * with THIS author / THESE topics recently. Interactions = reactions +
 * comments over the last 90 days. Self-interactions are ignored.
 *
 * A follow counts as FOLLOW_AFFINITY interaction-equivalents — subscribing
 * is a stronger declaration than any single tap, weaker than a habit.
 */
export type PersonalContext = {
  authorAffinity: Map<string, number>;
  tagAffinity: Map<string, number>;
  // Net EXPLICIT verdicts per tag (interested − not_interested, plus
  // picker picks). No time window — a stated preference never decays,
  // unlike the implicit signals above. Drives the strongest multiplier.
  explicitTags: Map<string, number>;
  // Authors the viewer follows. Relationship signal, separate from the
  // interaction counts so exploration can tell "unfamiliar" apart from
  // merely "uninteracted".
  followedAuthors: Set<string>;
};

// A follow ≈ 3 ordinary interactions. Strong enough to matter on day one,
// weak enough that a real habit (5+ interactions) outweighs it.
export const FOLLOW_AFFINITY = 3;

export function applyFollowsToContext(
  ctx: PersonalContext,
  followingIds: string[]
): void {
  for (const id of followingIds) {
    if (!id) continue;
    ctx.followedAuthors.add(id);
    ctx.authorAffinity.set(
      id,
      (ctx.authorAffinity.get(id) || 0) + FOLLOW_AFFINITY
    );
  }
}

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
      // Explicit verdicts are the strongest signal the ranker has —
      // track them separately so they can outweigh implicit history.
      ctx.explicitTags.set(t, (ctx.explicitTags.get(t) || 0) + weight);
    }
  }
}

// Picker picks: +2 per chosen topic, same strength as an "interested"
// verdict. Positive-only — picks boost matching topics and never demote
// unmatched ones.
const W_PICK = 2;

export function applyInterestsToContext(
  ctx: PersonalContext,
  interests: string[]
): void {
  for (const raw of interests) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    ctx.explicitTags.set(t, (ctx.explicitTags.get(t) || 0) + W_PICK);
    ctx.tagAffinity.set(t, (ctx.tagAffinity.get(t) || 0) + W_PICK);
  }
}

export async function buildPersonalContext(
  viewerId: string
): Promise<PersonalContext> {
  const since = new Date(Date.now() - AFFINITY_WINDOW_DAYS * 86_400_000);
  const [reactions, comments, follows] = await Promise.all([
    prisma.reaction.findMany({
      where: { userId: viewerId, createdAt: { gte: since } },
      select: { post: { select: { authorId: true, tags: true } } },
    }),
    prisma.comment.findMany({
      where: { authorId: viewerId, createdAt: { gte: since } },
      select: { post: { select: { authorId: true, tags: true } } },
    }),
    prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    }),
  ]);
  return buildPersonalContextFromRows(
    reactions,
    comments,
    viewerId,
    follows.map((f) => f.followingId)
  );
}

// Same aggregation as buildPersonalContext but over rows the caller already
// fetched — lets getPosts fold affinity into its single parallel query wave.
export function buildPersonalContextFromRows(
  reactions: { post: { authorId: string | null; tags: string | null } | null }[],
  comments: { post: { authorId: string | null; tags: string | null } | null }[],
  viewerId: string,
  followingIds: string[] = []
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
  const ctx: PersonalContext = {
    authorAffinity: authors,
    tagAffinity: tags,
    explicitTags: new Map(),
    followedAuthors: new Set(),
  };
  applyFollowsToContext(ctx, followingIds);
  return ctx;
}

// ── Propensity sub-models ────────────────────────────────────────────────
// P(viewer does X | post, context), each in [0,1], from observable features
// only. Heuristic weights today; every function below is a named seam where
// a learned model can be substituted later without touching ranking.
export type ActionPropensities = {
  read: number;
  like: number;
  comment: number;
  save: number;
  share: number;
  profileVisit: number;
  negative: number;
  skip: number;
};

export type PostFeatures = {
  likes: number;
  dislikes: number;
  comments: number;
  applications: number;
  ageH: number;
  authorA: number; // 0..1 normalized author affinity
  tagA: number; // 0..1 strongest matching tag affinity
  explicit: number; // strongest explicit-tag verdict (can be negative)
  followed: boolean;
  quality01: number; // saturating public-engagement quality
  controversy01: number; // dislike share
  discussability01: number; // existing discussion begets discussion
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function postTagsOf<T extends PostWithRelations>(post: T): string[] {
  return ((post as unknown as { tags?: string }).tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function authorIdOf<T extends PostWithRelations>(post: T): string {
  return (
    (post as unknown as { authorId?: string }).authorId ??
    (post as unknown as { author?: { id?: string } }).author?.id ??
    ""
  );
}

export function extractFeatures<T extends PostWithRelations>(
  post: T,
  ctx?: PersonalContext
): PostFeatures {
  const reactions = (post.reactions ?? []) as { type: string }[];
  const likes = reactions.filter((r) => r.type === "like").length;
  const dislikes = reactions.filter((r) => r.type === "dislike").length;
  const comments = post._count?.comments ?? 0;
  const applications = post._count?.applications ?? 0;
  const images = post._count?.images ?? 0;
  const ageH = Math.max(
    0,
    (Date.now() - post.createdAt.getTime()) / 3_600_000
  );
  const authorId = authorIdOf(post);
  const tags = postTagsOf(post);
  const authorA = Math.min(1, (ctx?.authorAffinity.get(authorId) || 0) / 5);
  let strongest = 0;
  let explicit = 0;
  for (const t of tags) {
    strongest = Math.max(strongest, ctx?.tagAffinity.get(t) || 0);
    explicit = Math.max(explicit, ctx?.explicitTags.get(t) || 0);
  }
  const tagA = Math.min(1, strongest / 3);
  const engagement = likes * 3 + comments * 4 + applications * 6;
  return {
    likes,
    dislikes,
    comments,
    applications,
    ageH,
    authorA,
    tagA,
    explicit,
    followed: ctx?.followedAuthors.has(authorId) ?? false,
    quality01: Math.min(1, engagement / 24 + (images > 0 ? 0.1 : 0)),
    controversy01: dislikes / (likes + dislikes + 1),
    discussability01: Math.min(1, comments / 8),
  };
}

export function predictPropensities(f: PostFeatures): ActionPropensities {
  const aff = Math.min(1, 0.6 * f.authorA + 0.4 * f.tagA);
  return {
    read: clamp01(0.55 + 0.25 * f.quality01 + 0.2 * aff - f.ageH / 336),
    like: clamp01(0.12 + 0.45 * aff + 0.2 * f.quality01 + (f.followed ? 0.1 : 0)),
    comment: clamp01(0.04 + 0.35 * aff + 0.3 * f.discussability01),
    save: clamp01(0.04 + 0.3 * aff + 0.25 * f.quality01),
    share: clamp01(0.02 + 0.25 * aff + 0.1 * f.quality01),
    profileVisit: clamp01(
      0.04 + 0.3 * f.authorA + 0.05 * f.quality01
    ),
    // Explicit negatives are commands, not hints. Otherwise controversy
    // is the only honest negative prior we have.
    negative:
      f.explicit < 0 ? 0.9 : clamp01(0.02 + 0.4 * f.controversy01),
    // No impression tracking (schema freeze), so skip is proxied: content
    // the viewer has no affinity for and nobody vouched for is the most
    // likely to be scrolled past. Documented approximation, not measurement.
    skip: clamp01(0.25 * (1 - aff) + 0.15 * (1 - f.quality01)),
  };
}

/**
 * Utility weights — VALUE, not vanity. A comment means someone thought;
 * a save means they'll return; a share recruits; a profile visit starts a
 * relationship; a like is a nod; a read is table stakes. Negative outcomes
 * subtract hard: one "less like this" outweighs several passive likes.
 * Tune these to move the product, not the metrics.
 */
export const UTILITY_WEIGHTS = {
  comment: 4,
  save: 3.5,
  share: 3,
  profileVisit: 2,
  like: 1,
  read: 0.5,
  negative: -6,
  skip: -1.5,
} as const;

// Steepness of the calibration sigmoid. Higher = winner-takes-more.
export const UTILITY_K = 1.5;

export function combineUtility(pr: ActionPropensities): number {
  const w = UTILITY_WEIGHTS;
  return (
    w.comment * pr.comment +
    w.save * pr.save +
    w.share * pr.share +
    w.profileVisit * pr.profileVisit +
    w.like * pr.like +
    w.read * pr.read +
    w.negative * pr.negative +
    w.skip * pr.skip
  );
}

/**
 * Self-calibration: utility is only meaningful RELATIVE to the pool being
 * ranked, so center it on the pool median. An average post scores ×1 no
 * matter the absolute numbers; above-taste trends toward ×2, mismatches
 * toward ×0. No magic baseline constant to retune as the product grows.
 */
export function calibrateUtility(U: number, medianU: number): number {
  return 2 / (1 + Math.exp(-UTILITY_K * (U - medianU)));
}

export function poolMedian(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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

// Cold-start probe for new voices: authors younger than NEW_VOICE_DAYS with
// no prior affinity get a small lift so the feed samples them instead of
// starving every unknown creator. Affinity, once earned, takes over.
export const NEW_VOICE_DAYS = 14;
export const NEW_VOICE_BOOST = 1.15;

// Consumption checks — the exposure policy layer.
export function hasReacted<T extends PostWithRelations>(
  post: T,
  viewerId: string
): boolean {
  return ((post.reactions ?? []) as { userId: string }[]).some(
    (r) => r.userId === viewerId
  );
}
export function isSaved<T extends PostWithRelations>(
  post: T,
  viewerId: string
): boolean {
  return (
    (post as unknown as { bookmarks?: { userId: string }[] }).bookmarks ?? []
  ).some((b) => b.userId === viewerId);
}
export function isOwnPost<T extends PostWithRelations>(
  post: T,
  viewerId: string
): boolean {
  return authorIdOf(post) === viewerId;
}

/**
 * The complete per-post score: public gravity prior × calibrated personal
 * utility × policy layers (explicit prefs, negative guard, new-voice probe,
 * hotness, consumed-content demotions, dislike damping, quiet penalty).
 *
 * medianU centers calibration on the pool being ranked — production callers
 * MUST pass the pool median (see scorePool). The default (0) is for
 * simulations and unit checks only.
 */
export function finalScore<T extends PostWithRelations>(
  p: T,
  now: Date = new Date(),
  ctx?: PersonalContext,
  signals?: EngagementSignals,
  medianU = 0
): number {
  const feats = extractFeatures(p, ctx);
  const props = predictPropensities(feats);
  const U = combineUtility(props);

  let s = feedScore(p, now) * calibrateUtility(U, medianU);

  // HOTNESS — acceleration up to ×2
  const recent = signals?.recent12h.get(p.id) ?? 0;
  if (recent > 0) {
    const hoursOld = Math.max(
      1,
      (now.getTime() - p.createdAt.getTime()) / 3_600_000
    );
    s *= Math.min(2, 1 + recent / Math.max(2, hoursOld) / 2);
  }

  // EXPLICIT INTEREST FACTOR — stated preferences dominate. One
  // "interested" verdict or one picker pick (+2 net on a shared tag)
  // already lifts every matching post ~×1.6, capping at ×2 so explicit
  // signals bend the feed hard without flattening gravity entirely.
  // Positive only: unmatched topics are never demoted for having no pick.
  if (feats.explicit > 0) s *= Math.min(2, 1 + 0.3 * feats.explicit);

  // NEGATIVE GUARD — "less like this" is a command. Explicit negative
  // verdicts (hard exclusion happens earlier in queries.ts; this catches
  // what slips through, e.g. same-author siblings) demote hard.
  const authorId = authorIdOf(p);
  const authorNegative = (ctx?.authorAffinity.get(authorId) || 0) < 0;
  let anyTagNegative = false;
  for (const t of postTagsOf(p)) {
    if ((ctx?.explicitTags.get(t) || 0) < 0) {
      anyTagNegative = true;
      break;
    }
  }
  if (authorNegative || anyTagNegative) s *= 0.45;

  // NEW-VOICE PROBE — sample unknown young creators instead of starving them.
  if (ctx && feats.explicit >= 0 && !authorNegative) {
    const authorCreated = (
      p as unknown as { author?: { createdAt?: Date | string } }
    ).author?.createdAt;
    const ageDays = authorCreated
      ? (now.getTime() - new Date(authorCreated).getTime()) / 86_400_000
      : Infinity;
    const affinity = ctx.authorAffinity.get(authorId) || 0;
    if (ageDays < NEW_VOICE_DAYS && affinity === 0 && !ctx.followedAuthors.has(authorId)) {
      s *= NEW_VOICE_BOOST;
    }
  }

  // CONSUMED-CONTENT DEMOTIONS — seen ×0.55, saved ×0.7, own ×0.7.
  if (signals?.viewerId) {
    if (hasReacted(p, signals.viewerId)) s *= 0.55;
    if (isSaved(p, signals.viewerId)) s *= 0.7;
    if (isOwnPost(p, signals.viewerId)) s *= 0.7;
  }

  // DISLIKE DAMPING — soft quality control
  s /= 1 + (feats.dislikes / (feats.likes + 1)) * 1.5;

  // QUIET PENALTY — hearts but no discussion is weaker signal
  if (feats.likes >= 3 && feats.comments === 0) s *= 0.9;

  return s;
}

/**
 * Score a whole pool with pool-relative calibration, computed once and
 * shared by ranking AND rotation (rotation jitters these exact numbers,
 * so personalization survives the reshuffle).
 */
export function scorePool<T extends PostWithRelations>(
  posts: T[],
  now: Date = new Date(),
  ctx?: PersonalContext,
  signals?: EngagementSignals
): Map<string, number> {
  const utilities = posts.map((p) =>
    combineUtility(predictPropensities(extractFeatures(p, ctx)))
  );
  const medianU = poolMedian(utilities);
  const scores = new Map<string, number>();
  for (const p of posts) {
    scores.set(p.id, finalScore(p, now, ctx, signals, medianU));
  }
  return scores;
}

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

  const scores = scorePool(posts, now, ctx, signals);
  const scored = posts.map((p) => ({ p, s: scores.get(p.id) ?? 0 }));

  return scored.sort((a, b) => b.s - a.s).map((x) => x.p);
}

export function hashStr(s: string): number {
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
 * 2. EXPLORATION — old gems (7+ days, outside the top 10) PLUS unfamiliar
 *    high-potential posts (fresh, unknown author, above-median gravity,
 *    unseen) are spliced at slots ~3 and ~8 by the hourly seed. Exploitation
 *    fills the rest. Exploration is a fixed small budget, never a lottery.
 * 3. AUTHOR + CATEGORY + TAG SPREAD — no author, category, or dominant tag
 *    appears three times back-to-back, and no author takes more than a
 *    quota share of the page (anti-domination).
 */
export type RotateOpts<T extends PostWithRelations> = {
  viewerId?: string;
  bucketHours?: number;
  scoreOf?: (p: T) => number;
  // Raw author-affinity counts (0 = unfamiliar). Defaults to all-zero.
  affinityOf?: (authorId: string) => number;
  // Page size, for the per-author quota. Defaults to no quota.
  limit?: number;
};

// No author may occupy more than ~1/5 of a page (minimum 3), however hot.
function authorQuota(limit?: number): number {
  if (limit == null) return Infinity;
  return Math.max(3, Math.floor(limit / 5));
}

export function rotateFeed<T extends PostWithRelations>(
  ranked: T[],
  opts: RotateOpts<T> = {}
): T[] {
  const now = new Date();
  const bucket = currentBucket(opts.bucketHours ?? 1);
  const seedKey = `${opts.viewerId ?? "anon"}:${bucket}`;
  // Jitter the FULL ranked score (personalization included). Callers that
  // ranked with a context must pass it back here — defaulting to raw
  // gravity would un-personalize every reshuffle.
  const scoreOf = opts.scoreOf ?? ((p: T) => feedScore(p, now));

  // 1) jittered resort (±12% on the full score), stable within the hour
  const jittered = ranked
    .map((p, i) => ({
      p,
      j: scoreOf(p) * (0.88 + 0.24 * hashStr(`${seedKey}:${p.id}:${i}`)),
    }))
    .sort((a, b) => b.j - a.j)
    .map((x) => x.p);

  // 2) exploration splice — old gems AND unfamiliar high-potential.
  // Unfamiliar = zero author affinity (follows count, so followed authors
  // are familiar), fresh (<48h), above-median public gravity, unseen by
  // this viewer. Deterministic per user/hour; empty pool = no splice.
  const weekAgo = Date.now() - 7 * 86_400_000;
  const twoDaysAgo = Date.now() - 2 * 86_400_000;
  const topIds = new Set(jittered.slice(0, 10).map((p) => p.id));
  const affinityOf = opts.affinityOf ?? (() => 0);
  const priors = ranked.map((p) => feedScore(p, now)).sort((a, b) => a - b);
  const medianPrior = priors.length
    ? priors[Math.floor(priors.length / 2)]
    : Infinity;
  const oldGems = jittered.filter(
    (p) => !topIds.has(p.id) && p.createdAt.getTime() < weekAgo
  );
  const freshUnfamiliar = jittered.filter((p) => {
    if (topIds.has(p.id)) return false;
    if (p.createdAt.getTime() < twoDaysAgo) return false;
    if ((affinityOf(authorIdOf(p)) || 0) > 0) return false;
    if (feedScore(p, now) <= medianPrior) return false;
    if (!opts.viewerId) return true;
    return (
      !hasReacted(p, opts.viewerId) &&
      !isSaved(p, opts.viewerId) &&
      !isOwnPost(p, opts.viewerId)
    );
  });
  const gemIds = new Set(oldGems.map((p) => p.id));
  const candidates = [
    ...oldGems,
    ...freshUnfamiliar.filter((p) => !gemIds.has(p.id)),
  ];
  const slots: Array<{ at: number; post: T | null }> = [
    { at: 3, post: null },
    { at: 8, post: null },
  ];
  const usedIdx = new Set<number>();
  for (const slot of slots) {
    // A single-candidate pool must not fill BOTH slots with the same post
    // (that renders it twice). Exhausted pool = empty slot, not a repeat.
    if (!candidates.length || usedIdx.size >= candidates.length) break;
    let idx = Math.floor(
      hashStr(`${seedKey}:explore:${slot.at}`) * candidates.length
    );
    while (usedIdx.has(idx)) {
      idx = (idx + 1) % candidates.length;
    }
    usedIdx.add(idx);
    slot.post = candidates[idx];
  }

  const mixed: T[] = [];
  let cursor = 0;
  // Explored posts are REMOVED from the main sequence when spliced in —
  // otherwise they render twice (once at the slot, once at their slot-less
  // position). This duplication shipped unnoticed because it only shows on
  // feeds with 7+ day old posts ranked outside the top 10.
  const used = new Set<string>(slots.filter((s) => s.post).map((s) => s.post!.id));
  let i = 0;
  while (true) {
    const slot = slots.find((s) => s.at === i && s.post);
    if (slot?.post) {
      mixed.push(slot.post);
      i++;
      continue;
    }
    while (cursor < jittered.length && used.has(jittered[cursor].id)) cursor++;
    if (cursor >= jittered.length) break;
    mixed.push(jittered[cursor++]);
    i++;
  }

  // 3) author + category + tag spread — never the same author, category,
  //    or dominant tag 3 times in a row; no author exceeds the page quota.
  //    Untagged posts carry a unique key so they never trip the tag rule.
  //    Impossible pools (fewer distinct values than slots) fall through to
  //    plain order — the feed never drops or hangs.
  const authorOf = (p: T) => authorIdOf(p) || "?";
  const categoryOf = (p: T) =>
    (p as unknown as { category?: string }).category ?? "?";
  const tagKeyOf = (p: T) => postTagsOf(p)[0] ?? `#${p.id}`;
  const quota = authorQuota(opts.limit);
  const authorCounts = new Map<string, number>();
  const spread: T[] = [];
  const rest = [...mixed];
  while (rest.length) {
    const lastTwo = spread.slice(-2);
    const runBlocked = (
      keyOf: (p: T) => string
    ): string | null => {
      if (lastTwo.length < 2 || !lastTwo[0] || !lastTwo[1]) return null;
      return keyOf(lastTwo[0]) === keyOf(lastTwo[1])
        ? keyOf(lastTwo[0])
        : null;
    };
    const authorBlocked = runBlocked(authorOf);
    const categoryBlocked = runBlocked(categoryOf);
    const tagBlocked = runBlocked(tagKeyOf);
    let idx = rest.findIndex(
      (p) =>
        (!authorBlocked || authorOf(p) !== authorBlocked) &&
        (!categoryBlocked || categoryOf(p) !== categoryBlocked) &&
        (!tagBlocked || tagKeyOf(p) !== tagBlocked) &&
        (authorCounts.get(authorOf(p)) || 0) < quota
    );
    if (idx === -1) idx = 0;
    const [next] = rest.splice(idx, 1);
    spread.push(next);
    authorCounts.set(authorOf(next), (authorCounts.get(authorOf(next)) || 0) + 1);
  }

  return spread;
}

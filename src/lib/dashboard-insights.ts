import type { CreatorAnalytics, CreatorDashboard } from "@/lib/queries";

export type InsightTone = "good" | "warn" | "idea";

export type Insight = {
  tone: InsightTone;
  title: string;
  body: string;
};

export type StreakState = {
  current: number;
  activeToday: boolean;
  best: number;
};

const DAY = 86_400_000;

// Weekly goals: fixed sensible defaults, no configuration UI to maintain.
// Progress comes from real counts; the targets are documented, not magic.
export const WEEKLY_GOALS = {
  posts: 3,
  replies: 5,
} as const;

export type GoalProgress = {
  id: "posts" | "replies" | "streak";
  label: string;
  done: number;
  target: number | null;
  complete: boolean;
  hint: string;
};

export function weeklyGoals(
  week: { posts: number; commentsReceived: number },
  streak: StreakState
): GoalProgress[] {
  return [
    {
      id: "posts",
      label: "Post 3 times",
      done: Math.min(week.posts, WEEKLY_GOALS.posts),
      target: WEEKLY_GOALS.posts,
      complete: week.posts >= WEEKLY_GOALS.posts,
      hint:
        week.posts >= WEEKLY_GOALS.posts
          ? "Weekly output done."
          : `${WEEKLY_GOALS.posts - week.posts} more to go.`,
    },
    {
      id: "replies",
      label: "Earn 5 replies",
      done: Math.min(week.commentsReceived, WEEKLY_GOALS.replies),
      target: WEEKLY_GOALS.replies,
      complete: week.commentsReceived >= WEEKLY_GOALS.replies,
      hint:
        week.commentsReceived >= WEEKLY_GOALS.replies
          ? "Conversation flowing."
          : "Ask a question or post a take.",
    },
    {
      id: "streak",
      label: "Keep the streak",
      done: streak.activeToday ? 1 : 0,
      target: 1,
      complete: streak.activeToday,
      hint: streak.activeToday
        ? `${streak.current}-day streak safe.`
        : streak.current > 0
          ? `${streak.current}-day streak needs one action today.`
          : "Post, reply, or react today to start one.",
    },
  ];
}

// Plain-language automated insights, priority-ordered, capped. Every rule
// reads real data and names a next action — no vanity observations, no
// "you're doing great!" filler. Pure function: fully unit-testable.
export function buildInsights(input: {
  analytics: Pick<CreatorAnalytics, "totals" | "prevTotals" | "topTags">;
  summary: Pick<CreatorDashboard, "recentPosts" | "totals">;
  streak: StreakState;
}): Insight[] {
  const { analytics, summary, streak } = input;
  const out: Insight[] = [];

  const cur =
    analytics.totals.likes +
    analytics.totals.comments +
    analytics.totals.bookmarks;
  const prev =
    analytics.prevTotals.likes +
    analytics.prevTotals.comments +
    analytics.prevTotals.bookmarks;

  // 1. Momentum — big swings first, they matter most right now.
  if (prev > 0 && cur >= prev * 1.2) {
    const pct = Math.round(((cur - prev) / prev) * 100);
    const tag = analytics.topTags[0]?.tag;
    out.push({
      tone: "good",
      title: `Engagement up ${pct}%`,
      body: tag
        ? `#${tag} is working — lean into it this week.`
        : "Whatever changed, keep doing it this week.",
    });
  } else if (prev > 0 && cur <= prev * 0.7) {
    const pct = Math.round(((prev - cur) / prev) * 100);
    out.push({
      tone: "warn",
      title: `Engagement dipped ${pct}%`,
      body: "A fresh post on a proven topic is the fastest fix.",
    });
  }

  // 2. Best topic — concrete "post more of this".
  const top = analytics.topTags[0];
  if (top && top.likes + top.comments + top.saves > 0) {
    out.push({
      tone: "idea",
      title: `#${top.tag} is your strongest topic`,
      body: `${top.likes} likes · ${top.comments} replies · ${top.saves} saves across ${top.posts} ${top.posts === 1 ? "post" : "posts"}.`,
    });
  }

  // 3. Ghost watch — silence after posting history.
  const latest = summary.recentPosts[0]?.createdAt;
  if (latest) {
    const daysSilent = Math.floor((Date.now() - new Date(latest).getTime()) / DAY);
    if (daysSilent >= 14) {
      out.push({
        tone: "warn",
        title: `Quiet for ${daysSilent} days`,
        body: "Your audience hasn't heard from you — one post restarts the loop.",
      });
    }
  }

  // 4. Crickets — output without any response.
  if (summary.totals.posts > 0 && cur === 0 && prev === 0) {
    out.push({
      tone: "idea",
      title: "Posting into the void?",
      body: "End posts with a question and reply to every comment — replies compound.",
    });
  }

  // 5. Streak at risk — only when it actually needs saving.
  if (streak.current > 0 && !streak.activeToday) {
    out.push({
      tone: "warn",
      title: `${streak.current}-day streak at risk`,
      body: "One post, reply, or reaction today keeps it alive.",
    });
  }

  // 6. Saved, not just liked — deep-value signal worth naming.
  if (analytics.totals.bookmarks >= 3) {
    const ratio =
      analytics.totals.likes > 0
        ? analytics.totals.bookmarks / analytics.totals.likes
        : 0;
    if (ratio >= 0.25) {
      out.push({
        tone: "good",
        title: "People shelve your posts",
        body: "High save rate means lasting value — guides and resources travel far.",
      });
    }
  }

  return out.slice(0, 4);
}

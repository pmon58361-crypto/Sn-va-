import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = {
  title: "Leaderboard — Snívať",
};

export const dynamic = "force-dynamic";

// Real engagement only: reactions/comments/applications RECEIVED on your
// content inside the window. Weighted by how much effort each signal costs
// the giver. No self-reported anything.
const WINDOWS = {
  weekly: { days: 7, label: "This week" },
  monthly: { days: 30, label: "This month" },
} as const;

type RangeKey = keyof typeof WINDOWS;
const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range: RangeKey = sp.range === "monthly" ? "monthly" : "weekly";
  const start = new Date(Date.now() - WINDOWS[range].days * 86_400_000);

  // Raw signal rows for the window (bounded), then aggregate by author in JS —
  // one hop past Post makes SQL groupBy awkward and volumes are small.
  const [likes, comments, applications, posts] = await Promise.all([
    prisma.reaction.findMany({
      where: { type: "like", createdAt: { gte: start } },
      select: { postId: true },
      take: 5000,
    }),
    prisma.comment.findMany({
      where: { createdAt: { gte: start } },
      select: { postId: true },
      take: 5000,
    }),
    prisma.application.findMany({
      where: { createdAt: { gte: start } },
      select: { postId: true },
      take: 5000,
    }),
    prisma.post.findMany({
      where: { createdAt: { gte: start }, hidden: false },
      select: { id: true, authorId: true },
      take: 5000,
    }),
  ]);

  const authorOf = new Map(posts.map((p) => [p.id, p.authorId]));
  // Include ALL post authors this window (posts-created counts too).
  const score = new Map<
    string,
    { likes: number; comments: number; applications: number; posts: number }
  >();
  const row = (id: string) => {
    let r = score.get(id);
    if (!r) {
      r = { likes: 0, comments: 0, applications: 0, posts: 0 };
      score.set(id, r);
    }
    return r;
  };
  for (const p of posts) row(p.authorId).posts += 1;
  for (const l of likes) {
    const a = authorOf.get(l.postId);
    if (a) row(a).likes += 1;
  }
  for (const c of comments) {
    const a = authorOf.get(c.postId);
    if (a) row(a).comments += 1;
  }
  for (const ap of applications) {
    const a = authorOf.get(ap.postId);
    if (a) row(a).applications += 1;
  }

  const ranked = (
    await Promise.all(
      Array.from(score.entries()).map(async ([userId, s]) => {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, image: true },
        });
        if (!u) return null;
        const points = s.likes * 1 + s.comments * 2 + s.applications * 3 + s.posts;
        return { user: u, ...s, points };
      })
    )
  )
    .filter((r): r is NonNullable<typeof r> => !!r && r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const tabHref = (r: RangeKey) => `/leaderboard?range=${r}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow mb-2">Community</p>
      <h1 className="text-3xl font-black tracking-tight text-ink">
        Leaderboard
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Most-valued members by real engagement received. Points: like = 1,
        comment = 2, application = 3, post = 1.
      </p>

      <div className="mt-5 inline-grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-hover/40 p-1 text-sm font-bold">
        {(Object.keys(WINDOWS) as RangeKey[]).map((r) => (
          <Link
            key={r}
            href={tabHref(r)}
            aria-current={range === r ? "page" : undefined}
            className={`rounded-lg px-4 py-2 transition ${
              range === r ? "bg-surface text-accent" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {WINDOWS[r].label}
          </Link>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="card mt-8 p-10 text-center text-sm text-ink-muted">
          The board resets every week — be the first on it.
        </p>
      ) : (
        <ol className="mt-8 space-y-2">
          {ranked.map((r, i) => (
            <li
              key={r.user.id}
              className="card flex items-center gap-3 p-3.5"
            >
              <span className="w-9 shrink-0 text-center text-lg font-black tabular-nums text-ink-faint">
                {MEDALS[i] ?? i + 1}
              </span>
              <Avatar name={r.user.name} image={r.user.image} size={40} />
              <Link
                href={`/profile/${r.user.id}`}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-accent"
              >
                {r.user.name || "Someone"}
                <span className="block text-xs font-normal text-ink-faint">
                  {r.posts} posts · {r.likes} likes · {r.comments} comments ·{" "}
                  {r.applications} applications
                </span>
              </Link>
              <span className="shrink-0 rounded-full bg-accent-tint px-3 py-1 text-sm font-bold tabular-nums text-accent">
                {r.points}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

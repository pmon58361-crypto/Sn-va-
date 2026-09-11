import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorDashboard, getCreatorAnalytics } from "@/lib/queries";
import { CATEGORY_META } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { CreatorAnalytics } from "@/components/dashboard/CreatorAnalytics";

export const metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

const RANGES: { id: string; days: number; label: string }[] = [
  { id: "7", days: 7, label: "Last 7 days" },
  { id: "28", days: 28, label: "Last 28 days" },
  { id: "all", days: 0, label: "All time" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/dashboard");
  const meId = session.user.id;

  if (!session.user.isCreator) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
        <div className="mt-6 border-y border-line py-10 text-center">
          <p className="text-sm text-ink-muted">
            Creator tools are switched off for your account.
          </p>
          <Link href="/settings" className="btn-primary mt-4 inline-block px-5 py-2 text-sm font-semibold">
            Turn on in Settings
          </Link>
        </div>
      </div>
    );
  }

  const { range, sort } = await searchParams;
  const activeRange = RANGES.find((r) => r.id === range) ?? RANGES[1];
  const postSort = sort === "liked" || sort === "commented" || sort === "saved" || sort === "engaged" ? sort : "new";
  const [analytics, summary] = await Promise.all([
    getCreatorAnalytics(meId, activeRange.days),
    getCreatorDashboard(meId),
  ]);

  // Memories — "on this day" from previous years (real posts only; the card
  // disappears entirely when there's nothing real to resurface).
  const today = new Date();
  const memories = await prisma.post.findMany({
    where: {
      authorId: meId,
      hidden: false,
      createdAt: { lt: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
      OR: [1, 2, 3].map((k) => {
        const y = today.getFullYear() - k;
        return {
          createdAt: {
            gte: new Date(y, today.getMonth(), today.getDate()),
            lt: new Date(y, today.getMonth(), today.getDate() + 1),
          },
        };
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, category: true, createdAt: true },
  });

  const stats = [
    { label: "Posts", value: summary.totals.posts },
    { label: "Likes", value: analytics.totals.likes },
    { label: "Comments", value: analytics.totals.comments },
    { label: "Followers", value: summary.totals.followers },
  ];

  // Best time to post (local hours of the viewer reading this).
  const timedTotal = analytics.byHour.reduce((a, b) => a + b, 0);
  const bestHour = analytics.byHour.indexOf(Math.max(...analytics.byHour));
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestDay = analytics.byWeekday.indexOf(Math.max(...analytics.byWeekday));
  const fmtHour = (h: number) => {
    const ampm = h < 12 ? "AM" : "PM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh} ${ampm}`;
  };

  // Per-post table, sortable via ?sort= (zero client JS, shareable URLs).
  const engagedScore = (p: { likes: number; comments: number; saves: number; applications: number }) =>
    p.likes + p.comments * 2 + p.saves * 2 + p.applications * 3;
  const sortedPosts = [...summary.recentPosts].sort((a, b) => {
    if (postSort === "liked") return b.likes - a.likes;
    if (postSort === "commented") return b.comments - a.comments;
    if (postSort === "saved") return b.saves - a.saves;
    if (postSort === "engaged") return engagedScore(b) - engagedScore(a);
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const sortHref = (s: string) =>
    `/dashboard?range=${activeRange.id}${s === "new" ? "" : `&sort=${s}`}`;
  const SORTS = [
    { id: "new", label: "Newest" },
    { id: "engaged", label: "Engaged" },
    { id: "liked", label: "Liked" },
    { id: "commented", label: "Discussed" },
    { id: "saved", label: "Saved" },
  ];

  // CSV export of the daily buckets behind the chart.
  const csv =
    "date,likes,comments,applications,saves,followers\n" +
    analytics.daily
      .map((d) => `${d.date},${d.likes},${d.comments},${d.applications},${d.bookmarks},${d.followers}`)
      .join("\n");
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">Dashboard</h1>
        <nav aria-label="Date range" className="flex rounded-full border border-line bg-soft p-1 text-[13px]">
          {RANGES.map((r) => {
            const isActive = r.id === activeRange.id;
            return (
              <Link
                key={r.id}
                href={`/dashboard?range=${r.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`rounded-full px-3.5 py-1.5 transition-colors touch-manipulation ${
                  isActive
                    ? "bg-surface font-semibold text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <p className="text-[13px] text-ink-muted">{c.label}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink">
              {c.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Memories — on-this-day; hidden when there's nothing real to show */}
      {memories.length > 0 && (
        <section className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <h2 className="text-sm font-semibold text-ink">
            On this day
          </h2>
          <ul className="mt-3 space-y-2">
            {memories.map((m) => {
              const years = today.getFullYear() - m.createdAt.getFullYear();
              const section =
                CATEGORY_META[m.category as keyof typeof CATEGORY_META]?.section ||
                "community";
              return (
                <li key={m.id} className="text-sm">
                  <Link
                    href={`/${section}/${m.id}`}
                    className="font-semibold text-ink hover:text-accent"
                  >
                    {m.title || "Untitled"}
                  </Link>
                  <span className="ml-2 text-xs text-ink-muted">
                    {years === 1 ? "1 year ago today" : `${years} years ago today`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <CreatorAnalytics
          daily={analytics.daily}
          totals={analytics.totals}
          prevTotals={analytics.prevTotals}
          last48h={analytics.last48h}
        />
      </div>

      {/* Precision row: when to post + what to post about */}
      {(timedTotal > 0 || analytics.topTags.length > 0) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {timedTotal > 0 && (
            <section className="card p-5" aria-label="Best time to post">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-ink">Best time to post</h2>
                <p className="text-xs text-ink-faint">
                  {fmtHour(bestHour)} · {WEEKDAYS[bestDay]}s
                </p>
              </div>
              <div className="mt-4 flex h-20 items-end gap-[3px]" aria-hidden>
                {analytics.byHour.map((v, h) => {
                  const max = Math.max(...analytics.byHour, 1);
                  return (
                    <div
                      key={h}
                      title={`${fmtHour(h)} — ${v}`}
                      className={`flex-1 rounded-sm ${h === bestHour ? "bg-accent" : "bg-accent/25"}`}
                      style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint" aria-hidden>
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                Your audience engages most around{" "}
                <span className="font-semibold text-ink">{fmtHour(bestHour)}</span>,
                peaking on <span className="font-semibold text-ink">{WEEKDAYS[bestDay]}s</span>.
              </p>
            </section>
          )}
          {analytics.topTags.length > 0 && (
            <section className="card p-5" aria-label="Top topics">
              <h2 className="text-sm font-semibold text-ink">Top topics</h2>
              <ul className="mt-3 space-y-2">
                {analytics.topTags.slice(0, 5).map((t) => (
                  <li key={t.tag} className="flex items-center gap-2 text-sm">
                    <span className="badge shrink-0 bg-soft text-ink-muted">#{t.tag}</span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-faint">
                      {t.likes} likes · {t.comments} replies · {t.saves} saves
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                Ranked by engagement across all your posts — post more of what
                tops this list.
              </p>
            </section>
          )}
        </div>
      )}

      {/* Your content */}
      <section className="mt-10 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
          <h2 className="text-sm font-semibold text-ink">Your posts</h2>
          <div className="flex items-center gap-1">
            {SORTS.map((s) => (
              <Link
                key={s.id}
                href={sortHref(s.id)}
                aria-current={postSort === s.id ? "true" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors touch-manipulation ${
                  postSort === s.id
                    ? "bg-soft text-ink"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            ))}
            <a
              href={csvHref}
              download={`snivat-analytics-${activeRange.id}.csv`}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-accent"
              title="Download the daily numbers behind the chart"
            >
              CSV
            </a>
          </div>
        </div>
        {sortedPosts.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            You haven&apos;t posted anything yet.
          </p>
        ) : (
          <ul>
            {sortedPosts.map((p) => {
              const meta =
                p.category === "COMMUNITY"
                  ? { href: `/community/${p.id}`, label: "Community" }
                  : p.category === "JOB_LISTING"
                  ? { href: `/applications/${p.id}`, label: "Job listing" }
                  : { href: `/jobs/${p.id}`, label: p.category === "JOB_OFFER" ? "Work offer" : "Work request" };
              const bits = [
                `${p.likes} ${p.likes === 1 ? "like" : "likes"}`,
                `${p.comments} ${p.comments === 1 ? "comment" : "comments"}`,
                `${p.saves} ${p.saves === 1 ? "save" : "saves"}`,
              ];
              if (p.category === "JOB_LISTING")
                bits.push(`${p.applications} ${p.applications === 1 ? "application" : "applications"}`);
              return (
                <li key={p.id} className="border-b border-line">
                  <Link
                    href={meta.href}
                    className="flex items-baseline gap-4 py-3 transition-colors hover:bg-[var(--bg-soft)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                      <span className="text-xs text-ink-faint">
                        {meta.label} · {timeAgo(p.createdAt)}
                        {p.status === "closed" && " · closed"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                      {bits.join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

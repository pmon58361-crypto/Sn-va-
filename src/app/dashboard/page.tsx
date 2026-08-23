import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCreatorDashboard, getCreatorAnalytics } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";
import { CreatorAnalytics } from "@/components/dashboard/CreatorAnalytics";

export const metadata = { title: "Dashboard — Snívať" };
export const dynamic = "force-dynamic";

const RANGES: { id: string; days: number; label: string }[] = [
  { id: "7", days: 7, label: "Last 7 days" },
  { id: "28", days: 28, label: "Last 28 days" },
  { id: "all", days: 0, label: "All time" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
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

  const { range } = await searchParams;
  const activeRange = RANGES.find((r) => r.id === range) ?? RANGES[1];

  const [analytics, summary] = await Promise.all([
    getCreatorAnalytics(meId, activeRange.days),
    getCreatorDashboard(meId),
  ]);

  const stats = [
    { label: "Posts", value: summary.totals.posts },
    { label: "Likes", value: analytics.totals.likes },
    { label: "Comments", value: analytics.totals.comments },
    { label: "Followers", value: summary.totals.followers },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">Dashboard</h1>
        <nav aria-label="Date range" className="flex gap-4 text-[13px]">
          {RANGES.map((r) => {
            const isActive = r.id === activeRange.id;
            return (
              <Link
                key={r.id}
                href={`/dashboard?range=${r.id}`}
                aria-current={isActive ? "true" : undefined}
                className={
                  isActive
                    ? "font-semibold text-ink"
                    : "text-ink-muted hover:text-ink"
                }
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Stat strip — plain numbers over hairlines */}
      <div className="mt-6 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {stats.map((c, i) => (
          <div
            key={c.label}
            className={`py-4 ${i > 0 ? "sm:border-l sm:border-line sm:pl-5" : ""} ${
              i === 2 ? "max-sm:border-t max-sm:border-line" : ""
            } ${i === 3 ? "max-sm:border-t max-sm:border-line max-sm:pl-5" : ""}`}
          >
            <p className="text-[13px] text-ink-muted">{c.label}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink">
              {c.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <CreatorAnalytics
          daily={analytics.daily}
          totals={analytics.totals}
          prevTotals={analytics.prevTotals}
          last48h={analytics.last48h}
        />
      </div>

      {/* Your content */}
      <section className="mt-10 pb-10">
        <div className="flex items-baseline justify-between border-b border-line pb-2">
          <h2 className="text-sm font-semibold text-ink">Your posts</h2>
          <Link href={`/profile/${meId}`} className="text-[13px] text-ink-muted hover:text-ink">
            All posts
          </Link>
        </div>
        {summary.recentPosts.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            You haven&apos;t posted anything yet.
          </p>
        ) : (
          <ul>
            {summary.recentPosts.map((p) => {
              const meta =
                p.category === "COMMUNITY"
                  ? { href: `/community/${p.id}`, label: "Community" }
                  : p.category === "JOB_LISTING"
                  ? { href: `/applications/${p.id}`, label: "Job listing" }
                  : { href: `/jobs/${p.id}`, label: p.category === "JOB_OFFER" ? "Work offer" : "Work request" };
              const bits = [
                `${p.likes} ${p.likes === 1 ? "like" : "likes"}`,
                `${p.comments} ${p.comments === 1 ? "comment" : "comments"}`,
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

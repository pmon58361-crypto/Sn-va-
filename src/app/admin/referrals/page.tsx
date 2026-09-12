import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referrals", robots: { index: false } };

const DAY_MS = 86_400_000;

// Acquisition funnel per first-touch source. Activation + return are
// DERIVED from existing tables (no extra columns): activated = first post
// within 7 days of signup; returned = any post/comment/reaction after day
// 7. JWT sessions leave no Session rows, so "return" means contributed —
// stricter than a visit, and honest about what it measures.
export default async function AdminReferralsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "admin") redirect("/");

  const [users, posts, comments, reactions] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, refSource: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.post.findMany({
      select: { authorId: true, createdAt: true },
    }),
    prisma.comment.findMany({
      select: { authorId: true, createdAt: true },
    }),
    prisma.reaction.findMany({
      select: { userId: true, createdAt: true },
    }),
  ]);

  const firstPostAt = new Map<string, number>();
  for (const p of posts) {
    const t = p.createdAt.getTime();
    if (!firstPostAt.has(p.authorId) || t < firstPostAt.get(p.authorId)!) {
      firstPostAt.set(p.authorId, t);
    }
  }
  const activeAfterDay7 = new Set<string>();
  const markLate = (userId: string, t: number, joined: number) => {
    if (t > joined + 7 * DAY_MS) activeAfterDay7.add(userId);
  };
  const joinedAt = new Map(users.map((u) => [u.id, u.createdAt.getTime()]));
  for (const p of posts) {
    const j = joinedAt.get(p.authorId);
    if (j != null) markLate(p.authorId, p.createdAt.getTime(), j);
  }
  for (const c of comments) {
    const j = joinedAt.get(c.authorId);
    if (j != null) markLate(c.authorId, c.createdAt.getTime(), j);
  }
  for (const r of reactions) {
    const j = joinedAt.get(r.userId);
    if (j != null) markLate(r.userId, r.createdAt.getTime(), j);
  }

  const rows = new Map<
    string,
    { signups: number; activated: number; returned: number }
  >();
  for (const u of users) {
    const key = u.refSource || "direct";
    const row = rows.get(key) ?? { signups: 0, activated: 0, returned: 0 };
    row.signups += 1;
    const joined = u.createdAt.getTime();
    const first = firstPostAt.get(u.id);
    if (first != null && first <= joined + 7 * DAY_MS) row.activated += 1;
    if (activeAfterDay7.has(u.id)) row.returned += 1;
    rows.set(key, row);
  }

  const table = [...rows.entries()].sort((a, b) => b[1].signups - a[1].signups);
  const totals = table.reduce(
    (acc, [, r]) => ({
      signups: acc.signups + r.signups,
      activated: acc.activated + r.activated,
      returned: acc.returned + r.returned,
    }),
    { signups: 0, activated: 0, returned: 0 }
  );
  const pct = (n: number, d: number) =>
    d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <Link
          href="/admin"
          className="mb-2 inline-block text-sm text-ink-muted transition hover:text-accent"
        >
          ← Moderation
        </Link>
        <h1 className="text-xl font-bold text-ink">Referrals</h1>
        <p className="text-sm text-ink-muted">
          First-touch source → signups → activated (first post ≤7d) →
          active after day 7. Vanity stops at signup.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-soft text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2.5 font-semibold">Source</th>
              <th className="px-4 py-2.5 text-right font-semibold">Signups</th>
              <th className="px-4 py-2.5 text-right font-semibold">Activated</th>
              <th className="px-4 py-2.5 text-right font-semibold">Day 7+</th>
            </tr>
          </thead>
          <tbody>
            {table.map(([source, r]) => (
              <tr key={source} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-mono text-[13px] text-ink">
                  {source}
                </td>
                <td className="px-4 py-2.5 text-right text-ink">{r.signups}</td>
                <td className="px-4 py-2.5 text-right text-ink">
                  {r.activated}{" "}
                  <span className="text-ink-faint">
                    ({pct(r.activated, r.signups)})
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-ink">
                  {r.returned}{" "}
                  <span className="text-ink-faint">
                    ({pct(r.returned, r.signups)})
                  </span>
                </td>
              </tr>
            ))}
            {table.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
          {table.length > 0 && (
            <tfoot>
              <tr className="bg-soft text-sm font-semibold text-ink">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right">{totals.signups}</td>
                <td className="px-4 py-2.5 text-right">
                  {totals.activated} ({pct(totals.activated, totals.signups)})
                </td>
                <td className="px-4 py-2.5 text-right">
                  {totals.returned} ({pct(totals.returned, totals.signups)})
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

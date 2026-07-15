import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";

// Right sidebar for the community page. Shows ONLY real data —
// recent activity from actual posts, and tags actually used in the DB.
// If insufficient data exists, renders elegant empty states (no faking).
export async function RightSidebar() {
  const [recentPosts, tagsResult] = await Promise.all([
    prisma.post.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: { status: "open" },
      include: {
        author: { select: { name: true, image: true } },
        _count: { select: { reactions: true, comments: true } },
      },
    }),
    // Extract real tags from the DB — no fabricated trends
    prisma.post.findMany({
      take: 100,
      where: { tags: { not: null } },
      select: { tags: true },
    }),
  ]);

  // Count tag frequency from real data
  const tagCounts = new Map<string, number>();
  for (const p of tagsResult) {
    if (!p.tags) continue;
    for (const t of p.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line px-5 py-6 xl:flex">
      {/* Recent Activity */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Recent Activity
        </h3>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-ink-faint">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((p) => (
              <Link
                key={p.id}
                href={`/community/${p.id}`}
                className="block rounded-lg p-2 transition hover:bg-line/40"
              >
                <p className="line-clamp-1 text-sm font-medium text-ink-soft">
                  {p.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {p.author?.name || "Someone"} · {timeAgo(p.createdAt)} ·{" "}
                  {p._count.reactions + p._count.comments} interactions
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Trending Skills — derived from real tag usage */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Tags
        </h3>
        {topTags.length === 0 ? (
          <p className="text-sm text-ink-faint">No tags in use yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topTags.map(([tag, count]) => (
              <Link
                key={tag}
                href={`/community?q=${encodeURIComponent(tag)}`}
                className="badge bg-soft text-xs text-ink-muted transition hover:bg-accent/10 hover:text-accent"
              >
                #{tag}
                <span className="ml-1 text-ink-faint">{count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";
import { CATEGORY_META } from "@/lib/types";

// Right sidebar for the community page. Shows ONLY real data —
// suggestions, trends, rankings and stats computed from the DB.
// If insufficient data exists, renders honest empty states (no faking).
export async function RightSidebar({ viewerId }: { viewerId?: string | null }) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    recentPosts,
    tagsResult,
    followingRows,
    whoToFollow,
    topVoices,
    postsThisWeek,
    openListings,
    liveStories,
    memberCount,
  ] = await Promise.all([
    prisma.post.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: { status: "open" },
      include: {
        author: { select: { name: true, image: true } },
        _count: { select: { reactions: true, comments: true } },
      },
    }),
    prisma.post.findMany({
      take: 100,
      where: { tags: { not: null }, status: "open" },
      select: { tags: true },
    }),
    viewerId
      ? prisma.follow.findMany({
          where: { followerId: viewerId },
          select: { followingId: true },
        })
      : Promise.resolve([] as { followingId: string }[]),
    prisma.user.findMany({
      where: {
        ...(viewerId ? { id: { notIn: [viewerId] } } : {}),
        OR: [{ settings: { publicProfile: true } }, { settings: null }],
      },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: 3,
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        _count: { select: { followers: true, posts: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ followers: { _count: "desc" } }],
      take: 5,
      select: {
        id: true,
        name: true,
        image: true,
        _count: { select: { followers: true, posts: true } },
      },
    }),
    prisma.post.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.post.count({ where: { category: "JOB_LISTING", status: "open" } }),
    prisma.story.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.user.count(),
  ]);

  // Exclude people already followed from suggestions.
  const followedIds = new Set(followingRows.map((f) => f.followingId));
  const suggestions = whoToFollow.filter((u) => !followedIds.has(u.id));

  // Count tag frequency from real data.
  const tagCounts = new Map<string, number>();
  for (const p of tagsResult) {
    if (!p.tags) continue;
    for (const t of p.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line px-5 py-6 xl:flex">
      {/* Who to follow */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Who to follow
        </h3>
        {suggestions.length === 0 ? (
          <p className="text-sm text-ink-faint">
            You're keeping up with everyone here.
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5">
                <Link href={`/profile/${u.id}`} className="shrink-0">
                  <Avatar name={u.name} image={u.image} size={38} />
                </Link>
                <Link href={`/profile/${u.id}`} className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold text-ink hover:underline">
                    {u.name || "Someone"}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    {u._count.followers}{" "}
                    {u._count.followers === 1 ? "follower" : "followers"}
                    {u.bio ? ` · ${u.bio}` : ""}
                  </p>
                </Link>
                <FollowButton
                  targetUserId={u.id}
                  following={false}
                  className="!px-4 !py-1 !text-xs"
                />
              </div>
            ))}
            <Link
              href="/people"
              className="block text-sm text-accent hover:underline"
            >
              Show more
            </Link>
          </div>
        )}
      </div>

      {/* Trending — real tags, ranked */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Trending
        </h3>
        {topTags.length === 0 ? (
          <p className="text-sm text-ink-faint">No tags in use yet.</p>
        ) : (
          <div className="space-y-1">
            {topTags.map(([tag, count], i) => (
              <Link
                key={tag}
                href={`/community?q=${encodeURIComponent(tag)}`}
                className="flex items-baseline gap-3 rounded-lg p-2 transition hover:bg-line/40"
              >
                <span className="w-4 shrink-0 text-right text-xs text-ink-faint">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  #{tag}
                </span>
                <span className="shrink-0 text-xs text-ink-faint">
                  {count} {count === 1 ? "post" : "posts"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top voices — most-followed members */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Top voices
        </h3>
        {topVoices.length === 0 ? (
          <p className="text-sm text-ink-faint">No members yet.</p>
        ) : (
          <div className="space-y-1">
            {topVoices.map((u, i) => (
              <Link
                key={u.id}
                href={`/profile/${u.id}`}
                className="flex items-center gap-2.5 rounded-lg p-2 transition hover:bg-line/40"
              >
                <span className="w-4 shrink-0 text-center text-xs font-bold text-ink-faint">
                  {i + 1}
                </span>
                <Avatar name={u.name} image={u.image} size={32} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium text-ink-soft">
                    {u.name || "Someone"}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {u._count.followers}{" "}
                    {u._count.followers === 1 ? "follower" : "followers"} ·{" "}
                    {u._count.posts} {u._count.posts === 1 ? "post" : "posts"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pulse — live platform stats */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          This week on Snívať
        </h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Stat label="new posts" value={postsThisWeek} />
          <Stat label="open jobs" value={openListings} />
          <Stat label="live stories" value={liveStories} />
          <Stat label="members" value={memberCount} />
        </dl>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Recent Activity
        </h3>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-ink-faint">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((p) => {
              const meta = CATEGORY_META[
                p.category as keyof typeof CATEGORY_META
              ];
              const href = `/${meta?.section || "community"}/${p.id}`;
              return (
                <Link
                  key={p.id}
                  href={href}
                  className="block rounded-lg p-2 transition hover:bg-line/40"
                >
                  <p title={p.title} className="line-clamp-1 text-sm font-medium text-ink-soft transition-colors hover:text-accent">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {p.author?.name || "Someone"} · {timeAgo(p.createdAt)} ·{" "}
                    {p._count.reactions + p._count.comments} interactions
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-lg font-bold text-ink">{value}</dd>
    </div>
  );
}

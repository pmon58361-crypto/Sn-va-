import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";
import { getSidebarAd } from "@/lib/ads";
import { AdCard } from "@/components/ads/AdCard";

// Right sidebar for the community page. Shows ONLY real data —
// suggestions, trends, rankings and stats computed from the DB.
// If insufficient data exists, renders honest empty states (no faking).
export async function RightSidebar({ viewerId }: { viewerId?: string | null }) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    tagsResult,
    followingRows,
    whoToFollow,
    topVoices,
    postsThisWeek,
    openListings,
    applicantsThisWeek,
    memberCount,
    liveNotes,
    photoStories,
  ] = await Promise.all([
    prisma.post.findMany({
      take: 100,
      where: { tags: { not: null }, status: "open", hidden: false },
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
        deactivatedAt: null,
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
      where: { deactivatedAt: null },
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
    // Real job applications this week — notes/stories are counted elsewhere,
    // this slot tracks hiring activity only.
    prisma.application.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count(),
    // Notes vs photo stories — separate numbers, same live window the rail
    // uses (expiresAt in the future). Notes are text-only (no upload).
    prisma.story.count({
      where: { expiresAt: { gt: new Date() }, imageUrl: null },
    }),
    prisma.story.count({
      where: { expiresAt: { gt: new Date() }, imageUrl: { not: null } },
    }),
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

  // Sponsored slot — first block; collapses to nothing when no ad is running.
  const sidebarAd = await getSidebarAd();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line px-5 py-6 xl:flex">
      {sidebarAd && <AdCard ad={sidebarAd} variant="sidebar" />}

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
          <Stat label="applicants" value={applicantsThisWeek} />
          <Stat label="members" value={memberCount} />
          <Stat label="live notes" value={liveNotes} />
          <Stat label="photo stories" value={photoStories} />
        </dl>
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

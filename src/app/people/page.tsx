import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPresence } from "@/lib/presence";
import { hueGradient } from "@/lib/hue";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";
import { ProfileHover } from "@/components/profile/ProfileHover";
import { excludeTestAccounts } from "@/lib/discovery";

export const metadata = { title: "People",
  description: "Meet everyone building on Snívať — find collaborators and follow their work." };
export const dynamic = "force-dynamic";

// Directory of real members. Only users whose settings allow a public
// profile are listed (missing settings row = public, matching the default).
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await auth();
  const meId = session?.user?.id;

  const users = await prisma.user.findMany({
    where: {
      ...(meId ? { id: { not: meId } } : {}),
      deactivatedAt: null,
      ...excludeTestAccounts,
      OR: [
        { settings: { publicProfile: true } },
        { settings: null },
      ],
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { bio: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      createdAt: true,
      _count: { select: { followers: true, posts: true } },
    },
    orderBy: [
      { posts: { _count: "desc" } },
      { followers: { _count: "desc" } },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  const presence = getPresence(users.map((u) => u.id));
  const onlineNow = users.filter((u) => presence[u.id]?.online).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const newThisWeek = users.filter(
    (u) => new Date(u.createdAt).getTime() >= weekAgo
  ).length;

  // Viewer follow state in ONE query — drives inline follow buttons.
  const followedIds = new Set(
    meId
      ? (
          await prisma.follow.findMany({
            where: { followerId: meId },
            select: { followingId: true },
          })
        ).map((f) => f.followingId)
      : []
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">People</h1>
      <p className="mb-2 mt-1 text-sm text-ink-muted">
        Everyone building here. Follow someone whose work you want to see.
      </p>
      <p className="mb-6 font-mono text-xs text-ink-faint">
        {users.length} {users.length === 1 ? "member" : "members"}
        {onlineNow > 0 && (
          <>
            {" "}· <span className="text-emerald-500">{onlineNow} online now</span>
          </>
        )}
        {newThisWeek > 0 && <> · {newThisWeek} joined this week</>}
      </p>

      {/* Search — same GET-form pattern as the jobs page; .input is 16px so
          iOS Safari never zooms on focus. */}
      <form className="mb-6 flex gap-2" action="/people" method="GET">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Search by name or bio."
          className="input"
        />
        <button type="submit" className="btn-outline shrink-0">
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-lg font-semibold">
            {q ? "Nobody matches that search" : "Nobody here yet"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {q
              ? "Try a shorter name, or a word from their bio."
              : "Members appear here as they join."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <ProfileHover key={u.id} userId={u.id}>
              {/* Card is a plain div (not a link): the follow button inside
                  must stay a real button, so only the identity row links. */}
              <div className="card card-hover overflow-hidden">
                <div
                  aria-hidden
                  className="h-12 w-full"
                  style={{ background: hueGradient(u.name) }}
                />
                <div className="relative p-4 pt-0">
                {/* Avatar overlaps the banner; the identity block below
                    starts on clean background — no text ever sits on art. */}
                <div className="relative z-10 -mt-6 mb-2 w-fit">
                  <span className="relative block shrink-0 rounded-full ring-4 ring-[var(--bg-surface,#1a1a1c)]">
                    <Avatar name={u.name} image={u.image} size={52} />
                    {presence[u.id]?.online && (
                      <span
                        aria-label="Online now"
                        title="Online now"
                        className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-bg bg-emerald-400"
                      />
                    )}
                  </span>
                </div>
                <Link
                  href={`/profile/${u.id}`}
                  className="block min-w-0"
                >
                  <span className="flex items-center gap-2 truncate text-sm font-bold hover:underline">
                    {u.name || "Someone"}
                    {presence[u.id]?.online && (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                        online{presence[u.id].page ? ` · ${presence[u.id].page}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">
                    {u._count.followers}{" "}
                    {u._count.followers === 1 ? "follower" : "followers"} ·{" "}
                    {u._count.posts} {u._count.posts === 1 ? "post" : "posts"}
                  </span>
                  {u.bio && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-ink-muted">
                      {u.bio}
                    </span>
                  )}
                </Link>
                {meId && (
                  <FollowButton
                    targetUserId={u.id}
                    following={followedIds.has(u.id)}
                    className="mt-3 w-full !px-4 !py-1.5 !text-sm"
                  />
                )}
                </div>
              </div>
            </ProfileHover>
          ))}
        </div>
      )}
    </div>
  );
}

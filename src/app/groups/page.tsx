import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPresence } from "@/lib/presence";
import { Avatar } from "@/components/ui/Avatar";
import { CreateGroupButton } from "@/components/groups/CreateGroupModal";
import { GroupCover } from "@/components/groups/GroupCover";

export const metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

// Directory — browse/search every public group. Private groups appear with
// a lock chip (name + size are not secrets; the feed is what's gated).
export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort } = await searchParams;
  const session = await auth();
  const popular = sort === "popular";

  const groups = await prisma.group.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: popular
      ? { members: { _count: "desc" } }
      : { createdAt: "desc" },
    take: 50,
    include: {
      _count: { select: { members: true, posts: true } },
      creator: { select: { name: true } },
      members: {
        take: 6,
        orderBy: { joinedAt: "desc" },
        select: {
          userId: true,
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });

  // Online-now per group (in-memory presence over member ids — one call).
  const presence = getPresence(groups.flatMap((g) => g.members.map((m) => m.userId)));
  const onlineCount = (members: { userId: string }[]) =>
    members.filter((m) => presence[m.userId]?.online).length;

  // Featured hero: most-posted group (ties → most members). Always shown
  // when any group exists; excluded from the grid below — no duplicates.
  // A single group still gets the full stage instead of a lonely card.
  const featured =
    groups.length > 0
      ? [...groups].sort(
          (a, b) =>
            b._count.posts - a._count.posts ||
            b._count.members - a._count.members
        )[0]
      : null;
  const rest = featured ? groups.filter((g) => g.id !== featured.id) : groups;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* ── Discovery hero: oversized display type, live totals, red glow ── */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-8 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/25 blur-[90px]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
              Groups
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-ink sm:text-5xl">
              Find your people
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
              Small rooms around crafts, cities and side-quests.
            </p>
            <p className="mt-3 font-mono text-xs text-ink-faint">
              {groups.length} {groups.length === 1 ? "room" : "rooms"} ·{" "}
              {groups.reduce((n, g) => n + g._count.members, 0)} members ·{" "}
              {groups.reduce((n, g) => n + g._count.posts, 0)} posts
            </p>
          </div>
          <CreateGroupButton signedIn={!!session?.user?.id} />
        </div>
      </div>

      <form action="/groups" method="GET" className="mt-5 flex gap-2">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Search groups…"
          className="input"
        />
        <button type="submit" className="btn-outline shrink-0">
          Search
        </button>
      </form>

      <div className="mt-3 flex gap-2 text-sm">
        <Link
          href={`/groups${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={`rounded-full border px-3 py-1 ${
            !popular ? "border-accent font-bold text-ink" : "border-line text-ink-muted"
          }`}
        >
          New
        </Link>
        <Link
          href={`/groups?${new URLSearchParams({
            ...(q ? { q } : {}),
            sort: "popular",
          })}`}
          className={`rounded-full border px-3 py-1 ${
            popular ? "border-accent font-bold text-ink" : "border-line text-ink-muted"
          }`}
        >
          Popular
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="card mt-8 p-14 text-center">
          <p className="text-lg font-semibold">
            {q ? `No groups match "${q}"` : "No groups yet"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {q
              ? "Try a different keyword."
              : "Be the first to start one — it takes ten seconds."}
          </p>
        </div>
      ) : (
        <>
          {featured && (
            <Link
              href={`/groups/${featured.slug}`}
              className="card card-hover mt-6 block overflow-hidden transition-all"
            >
              <div className="relative">
                <div className="h-36 w-full overflow-hidden sm:h-44">
                  <div className="h-full w-full [&>div]:h-full [&>img]:h-full">
                    <GroupCover name={featured.name} coverUrl={featured.coverUrl} />
                  </div>
                </div>
                <span className="absolute left-4 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-300">
                  Featured
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <MemberStack members={featured.members} />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-ink">
                      {featured.name}
                    </h2>
                    <p className="font-mono text-xs text-ink-faint">
                      {featured._count.members}{" "}
                      {featured._count.members === 1 ? "member" : "members"} ·{" "}
                      {featured._count.posts}{" "}
                      {featured._count.posts === 1 ? "post" : "posts"}
                      {onlineCount(featured.members) > 0 && (
                        <>
                          {" "}·{" "}
                          <span className="text-emerald-500">
                            {onlineCount(featured.members)} online now
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {featured.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-snug text-ink-muted">
                    {featured.description}
                  </p>
                )}
              </div>
            </Link>
          )}
          {rest.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {rest.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.slug}`}
                className="card card-hover overflow-hidden transition-all"
              >
                <GroupCover name={g.name} coverUrl={g.coverUrl} />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold text-ink">
                      {g.name}
                    </h2>
                    {g.visibility === "private" && (
                      <span className="badge shrink-0 bg-[var(--bg-soft)] text-xs text-ink-muted">
                        private
                      </span>
                    )}
                  </div>
                  {g.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-muted">
                      {g.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <MemberStack members={g.members} small />
                    <p className="truncate font-mono text-xs text-ink-faint">
                      {g._count.members}{" "}
                      {g._count.members === 1 ? "member" : "members"} ·{" "}
                      {g._count.posts} {g._count.posts === 1 ? "post" : "posts"}
                      {onlineCount(g.members) > 0 && (
                        <>
                          {" "}·{" "}
                          <span className="text-emerald-500">
                            {onlineCount(g.members)} online
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}

// Overlapping member avatar stack (Discord-server-card language).
function MemberStack({
  members,
  small,
}: {
  members: { user: { id: string; name: string | null; image: string | null } }[];
  small?: boolean;
}) {
  const shown = members.slice(0, 5);
  if (shown.length === 0) return null;
  const size = small ? 22 : 26;
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {shown.map((m) => (
        <span
          key={m.user.id}
          className="rounded-full ring-2 ring-[var(--bg-surface,#1a1a1c)]"
        >
          <Avatar
            name={m.user.name}
            image={m.user.image}
            size={size}
          />
        </span>
      ))}
    </span>
  );
}

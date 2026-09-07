import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPresence } from "@/lib/presence";
import { CreateGroupButton } from "@/components/groups/CreateGroupModal";
import { GroupCard } from "@/components/groups/GroupCard";

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
      {/* ── Discovery hero: Discord-scale display type on brand gradient ── */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-10 sm:px-10 sm:py-12"
        style={{ background: "linear-gradient(120deg, #7f1d1d 0%, #450a0a 45%, #0a0a0b 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-red-600/30 blur-[100px]"
        />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-red-300">
            Groups
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
            Find your
            <br />
            people
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
            Small rooms around crafts, cities and side-quests.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CreateGroupButton signedIn={!!session?.user?.id} />
            <p className="font-mono text-xs text-white/50">
              {groups.length} {groups.length === 1 ? "room" : "rooms"} ·{" "}
              {groups.reduce((n, g) => n + g._count.members, 0)} members ·{" "}
              {groups.reduce((n, g) => n + g._count.posts, 0)} posts
            </p>
          </div>
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
            <div className="mt-6">
              <GroupCard
                group={featured}
                online={onlineCount(featured.members)}
                featured
              />
            </div>
          )}
          {rest.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {rest.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                online={onlineCount(g.members)}
              />
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}

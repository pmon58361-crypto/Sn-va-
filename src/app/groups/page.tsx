import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPresence } from "@/lib/presence";
import { normalizeCategory } from "@/lib/group-categories";
import { CreateGroupButton } from "@/components/groups/CreateGroupModal";
import { GroupCard } from "@/components/groups/GroupCard";

export const metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

// Directory — browse/search every public group. Private groups appear with
// a lock chip (name + size are not secrets; the feed is what's gated).
export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; category?: string }>;
}) {
  const { q, sort, category: categoryParam } = await searchParams;
  const session = await auth();
  const popular = sort === "popular";
  const category = normalizeCategory(categoryParam);

  const groups = await prisma.group.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
    },
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

  // Category tabs: only categories that actually exist (real rooms only —
  // never an empty tab). Small table, one extra read.
  const categoryRows = await prisma.group.findMany({
    select: { category: true },
    take: 200,
  });
  const liveCategories = Array.from(
    new Set(
      categoryRows
        .map((r) => r.category)
        .filter((c): c is string => !!c)
    )
  ).sort();
  const chipHref = (c: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (popular) params.set("sort", "popular");
    if (c) params.set("category", c);
    const s = params.toString();
    return `/groups${s ? `?${s}` : ""}`;
  };
  const newHref = (() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const s = params.toString();
    return `/groups${s ? `?${s}` : ""}`;
  })();

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

  const totalMembers = groups.reduce((n, g) => n + g._count.members, 0);
  const totalPosts = groups.reduce((n, g) => n + g._count.posts, 0);
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* ── Discovery billboard (Discord language, brand palette): deep
          indigo stage, display type, live counts, create action. ── */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-10 sm:px-10 sm:py-12"
        style={{ background: "linear-gradient(120deg, #2b2350 0%, #17142e 55%, #0a0a0b 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-indigo-500/25 blur-[100px]"
        />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-indigo-300">
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
              {plural(groups.length, "room", "rooms")} ·{" "}
              {plural(totalMembers, "member", "members")} ·{" "}
              {plural(totalPosts, "post", "posts")}
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

      {/* ── Tab bar (Discord nav language): text tabs, active gets the
          accent underline. Categories only render for rooms that exist. ── */}
      <nav aria-label="Browse groups" className="mt-5 flex items-center gap-5 overflow-x-auto border-b border-line text-[15px]">
        <TabLink href={chipHref(null)} active={!category}>
          All
        </TabLink>
        {liveCategories.map((c) => (
          <TabLink key={c} href={chipHref(c)} active={category === c} capitalize>
            {c}
          </TabLink>
        ))}
        <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden />
        <TabLink
          href={`${newHref}${newHref.includes("?") ? "&" : "?"}sort=popular`}
          active={popular}
        >
          Popular
        </TabLink>
      </nav>

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
            <section className="mt-8" aria-label="Featured rooms">
              <h2 className="mb-3 text-lg font-bold tracking-tight text-ink">
                Featured rooms
              </h2>
              <GroupCard
                group={featured}
                online={onlineCount(featured.members)}
                featured
              />
            </section>
          )}
          {rest.length > 0 && (
          <section className="mt-8" aria-label="More rooms">
            <h2 className="mb-3 text-lg font-bold tracking-tight text-ink">
              {featured ? "More rooms" : "All rooms"}
            </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                online={onlineCount(g.members)}
              />
            ))}
          </div>
          </section>
          )}
        </>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  capitalize,
  children,
}: {
  href: string;
  active?: boolean;
  capitalize?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 border-b-2 pb-2 pt-1 transition-colors ${
        capitalize ? "capitalize" : ""
      } ${
        active
          ? "border-accent font-bold text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

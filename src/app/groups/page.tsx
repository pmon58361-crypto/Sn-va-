import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateGroupButton } from "@/components/groups/CreateGroupModal";

export const metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

// Directory — browse/search every public group. Private groups appear with
// a lock chip (name + size are not secrets; the feed is what's gated).
export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await auth();

  const groups = await prisma.group.findMany({
    where: q
      ? { name: { contains: q, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      _count: { select: { members: true, posts: true } },
      creator: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Groups</p>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Find your people
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Small rooms around crafts, cities and side-quests.
          </p>
        </div>
        <CreateGroupButton signedIn={!!session?.user?.id} />
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
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.slug}`}
              className="card card-hover overflow-hidden transition-all"
            >
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.coverUrl}
                  alt=""
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="grid h-24 w-full place-items-center bg-gradient-to-tr from-accent/25 to-like/20 text-2xl font-black text-ink">
                  {(g.name || "?").trim().charAt(0).toUpperCase()}
                </div>
              )}
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
                <p className="mt-2 font-mono text-xs text-ink-faint">
                  {g._count.members}{" "}
                  {g._count.members === 1 ? "member" : "members"} ·{" "}
                  {g._count.posts} {g._count.posts === 1 ? "post" : "posts"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

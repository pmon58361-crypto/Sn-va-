import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPresence } from "@/lib/presence";
import { Avatar } from "@/components/ui/Avatar";

export const metadata = { title: "People — Snívať" };
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">People</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        Everyone building here. Follow someone whose work you want to see.
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
            <Link
              key={u.id}
              href={`/profile/${u.id}`}
              className="card card-hover flex items-start gap-3 p-4"
            >
              <span className="relative">
                <Avatar name={u.name} image={u.image} size={44} />
                {presence[u.id]?.online && (
                  <span
                    aria-label="Online now"
                    title="Online now"
                    className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-bg bg-emerald-400"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-bold">
                  {u.name || "Someone"}
                  {presence[u.id]?.online && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                      online{presence[u.id].page ? ` · ${presence[u.id].page}` : ""}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {u._count.followers}{" "}
                  {u._count.followers === 1 ? "follower" : "followers"} ·{" "}
                  {u._count.posts} {u._count.posts === 1 ? "post" : "posts"}
                </p>
                {u.bio && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                    {u.bio}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

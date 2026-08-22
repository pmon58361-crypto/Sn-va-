import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";

export const metadata = { title: "People — Snívať" };
export const dynamic = "force-dynamic";

// Directory of real members. Only users whose settings allow a public
// profile are listed (missing settings row = public, matching the default).
export default async function PeoplePage() {
  const session = await auth();
  const meId = session?.user?.id;

  const users = await prisma.user.findMany({
    where: {
      ...(meId ? { id: { not: meId } } : {}),
      OR: [{ settings: { publicProfile: true } }, { settings: null }],
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">People</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        Everyone building here. Follow someone whose work you want to see.
      </p>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-lg font-semibold">Nobody here yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Members appear here as they join.
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
              <Avatar name={u.name} image={u.image} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {u.name || "Someone"}
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

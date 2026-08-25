import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMembership, canViewGroup } from "@/lib/groups";
import { getPosts } from "@/lib/queries";
import { PostCard } from "@/components/posts/PostCard";
import {
  GroupActions,
  KickButton,
} from "@/components/groups/GroupActions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await prisma.group.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });
  return { title: group ? `${group.name} — Groups` : "Groups" };
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const meId = session?.user?.id;
  const isAdmin = session?.user?.role === "admin";

  const group = await prisma.group.findUnique({
    where: { slug },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { members: true, posts: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        take: 24,
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });
  if (!group) notFound();

  const membership = await getMembership(group.id, meId);
  const isMember = !!membership;
  const isOwner = membership?.role === "owner" || isAdmin;

  // Private groups show header + locked notice to outsiders.
  const canView = canViewGroup(
    { visibility: group.visibility },
    membership,
    isAdmin
  );

  const feed = canView
    ? await getPosts({ groupId: group.id, viewerId: meId, sort: "new", limit: 50 })
    : [];

  const ownerName =
    group.members.find((m) => m.role === "owner")?.user.name ||
    group.creator.name;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      {/* ── Group header ── */}
      <section className="card overflow-hidden">
        {group.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.coverUrl} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="grid h-24 w-full place-items-center bg-gradient-to-tr from-accent/25 to-like/20 text-4xl font-black text-ink">
            {(group.name || "?").trim().charAt(0).toUpperCase()}
          </div>
        )}

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="break-words text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {group.name}
            </h1>
            <span className="badge shrink-0 bg-[var(--bg-soft)] text-xs capitalize text-ink-muted">
              {group.visibility}
            </span>
            <span className="badge shrink-0 bg-[var(--bg-soft)] text-xs capitalize text-ink-muted">
              {group.joinMode} join
            </span>
          </div>

          {group.description && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
              {group.description}
            </p>
          )}

          <p className="mt-3 font-mono text-xs text-ink-faint">
            {group._count.members}{" "}
            {group._count.members === 1 ? "member" : "members"} ·{" "}
            {group._count.posts} {group._count.posts === 1 ? "post" : "posts"} ·
            owner {ownerName || "unknown"}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isMember && (
              <Link
                href={`/new?group=${group.id}`}
                className="btn-primary shrink-0 px-4 py-2 text-sm"
              >
                Post to group
              </Link>
            )}
            {!meId ? (
              <Link
                href={`/auth/signin?callbackUrl=/groups/${group.slug}`}
                className="btn-primary block flex-1 py-2 text-center text-sm"
              >
                Sign in to join
              </Link>
            ) : (
              <div className="min-w-[200px] flex-1">
                <GroupActions
                  groupId={group.id}
                  ownerId={group.creatorId}
                  ownerName={ownerName}
                  isOwner={membership?.role === "owner"}
                  isMember={isMember}
                  joinMode={group.joinMode as "open" | "approval"}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Members strip (owner sees kick controls) ── */}
      <section className="card mt-5 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Members ({group._count.members})
        </h2>
        <ul className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <li
              key={m.userId}
              className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2"
            >
              <Link href={`/profile/${m.user.id}`} className="flex items-center gap-2">
                {m.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.user.image}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                    {(m.user.name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[140px] truncate text-xs font-medium text-ink">
                  {m.user.name || "Someone"}
                  {m.role === "owner" && (
                    <span className="ml-1 text-[10px] uppercase text-accent">
                      owner
                    </span>
                  )}
                </span>
              </Link>
              {(isOwner || isAdmin) &&
                m.role !== "owner" &&
                m.userId !== meId && (
                  <KickButton groupId={group.id} userId={m.userId} />
                )}
            </li>
          ))}
        </ul>
        {group._count.members > group.members.length && (
          <p className="mt-2 font-mono text-xs text-ink-faint">
            +{group._count.members - group.members.length} more
          </p>
        )}
      </section>

      {/* ── Feed ── */}
      {!canView ? (
        <div className="card mt-5 p-14 text-center">
          <p className="text-lg font-semibold">This group is private</p>
          <p className="mt-1 text-sm text-ink-muted">
            Join the group to see its posts.
          </p>
        </div>
      ) : feed.length === 0 ? (
        <div className="card mt-5 p-14 text-center">
          <p className="text-lg font-semibold">No posts yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            {isMember
              ? "Be the first — post from the New Post page."
              : "Members haven't posted yet."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {feed.map((p) => (
            <PostCard key={p.id} post={p} viewerId={meId} />
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMembership, canViewGroup } from "@/lib/groups";
import { getPosts } from "@/lib/queries";
import { getPresence } from "@/lib/presence";
import { GroupPostRow } from "@/components/groups/GroupPostRow";
import { GroupCover } from "@/components/groups/GroupCover";
import {
  GroupActions,
  KickButton,
} from "@/components/groups/GroupActions";
import {
  JoinRequestButton,
  PendingRequests,
  MemberControls,
  InviteButton,
  RulesCard,
} from "@/components/groups/GroupModeration";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const { view, sort: sortParam } = await searchParams;
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
  const myRole = membership?.role ?? null;
  const canMod = isOwner || myRole === "moderator";

  // Pending join requests (moderators+ see them) and my own request state.
  const [pendingRequests, myRequest] = await Promise.all([
    canMod
      ? prisma.groupJoinRequest.findMany({
          where: { groupId: group.id },
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        })
      : Promise.resolve([]),
    !isMember && meId
      ? prisma.groupJoinRequest.findUnique({
          where: { groupId_userId: { groupId: group.id, userId: meId } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  // Private groups show header + locked notice to outsiders.
  const canView = canViewGroup(
    { visibility: group.visibility },
    membership,
    isAdmin
  );

  const feed = canView
    ? await getPosts({
        groupId: group.id,
        viewerId: meId,
        sort: sortParam === "best" ? "best" : "new",
        limit: 50,
      })
    : [];

  // Discord-server anatomy: real slices of the feed as channels (no new
  // schema — these are honest filters over what already exists).
  const activeView = view === "media" || view === "polls" ? view : "all";
  const mediaPosts = feed.filter((p) => p.images.length > 0);
  const pollPosts = feed.filter(
    (p) => (p as { polls?: unknown[] }).polls?.length
  );
  const visibleFeed =
    activeView === "media" ? mediaPosts : activeView === "polls" ? pollPosts : feed;
  const viewHref = (v: string) =>
    v === "all" ? `/groups/${slug}` : `/groups/${slug}?view=${v}`;

  // Roster presence (in-memory, one call) + Discord role ordering: owner,
  // then online, then everyone else.
  const presence = getPresence(group.members.map((m) => m.userId));
  const roster = [...group.members].sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (b.role === "owner" && a.role !== "owner") return 1;
    const ao = presence[a.userId]?.online ? 0 : 1;
    const bo = presence[b.userId]?.online ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (a.user.name || "").localeCompare(b.user.name || "");
  });
  const onlineCount = group.members.filter(
    (m) => presence[m.userId]?.online
  ).length;

  const ownerName =
    group.members.find((m) => m.role === "owner")?.user.name ||
    group.creator.name;

  // Pinned highlights (moderator-curated). Privacy-respecting: outsiders of
  // private groups never get here (canView gate above feeds everything).
  const pinned = canView
    ? await prisma.post.findMany({
        where: { groupId: group.id, isPinned: true, hidden: false },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          author: { select: { id: true, name: true, image: true } },
          _count: { select: { comments: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      {/* ── Group header ── */}
      <section className="card overflow-hidden">
        {/* Real art gets the full stage; the fallback tile only needs
            a slim band — a tall empty gradient reads as broken. */}
        <div className={`w-full overflow-hidden ${group.coverUrl ? "h-36 sm:h-44" : "h-24 sm:h-28"} [&>div]:h-full [&>img]:h-full`}>
          <GroupCover name={group.name} coverUrl={group.coverUrl} />
        </div>

        <div className="p-5 pt-0">
          {/* Overlapping avatar tile — identity sits on the art, Reddit-style. */}
          <div className="relative z-10 -mt-7 mb-2 flex items-end">
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-accent text-2xl font-black text-white ring-4 ring-[var(--bg-surface,#1a1a1c)]">
              {(group.name || "?").trim().charAt(0).toUpperCase()}
            </span>
          </div>
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
            {onlineCount > 0 && (
              <>
                {" "}·{" "}
                <span className="text-emerald-500">{onlineCount} online</span>
              </>
            )}{" "}
            · since{" "}
            {new Date(group.createdAt).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isMember && (
              <>
                <Link
                  href={`/new?group=${group.id}`}
                  className="btn-primary shrink-0 px-4 py-2 text-sm"
                >
                  Post to group
                </Link>
                <InviteButton slug={group.slug} />
              </>
            )}
            {!meId ? (
              <Link
                href={`/auth/signin?callbackUrl=/groups/${group.slug}`}
                className="btn-primary block flex-1 py-2 text-center text-sm"
              >
                Sign in to join
              </Link>
            ) : !isMember && (group.joinMode !== "open" || group.visibility !== "public") ? (
              // Approval groups — and private groups of any join mode, where
              // direct join is impossible — take tracked requests (no more
              // "DM the owner" dead-end).
              <div className="min-w-[220px] flex-1">
                <JoinRequestButton
                  groupId={group.id}
                  hasPending={!!myRequest}
                />
              </div>
            ) : (
              // Owners get roomier controls (the cramped shrink-0 column
              // squeezed Change/Remove/Delete into a dangling mess); everyone
              // else gets the full-width join.
              <div
                className={
                  membership?.role === "owner"
                    ? "min-w-[220px] flex-1"
                    : "min-w-[200px] flex-1"
                }
              >
                <GroupActions
                  groupId={group.id}
                  isOwner={membership?.role === "owner"}
                  isMember={isMember}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Server body: channels rail · feed · roster (stacks on mobile) ── */}
      {canMod && (
        <PendingRequests
          groupId={group.id}
          requests={pendingRequests.map((r) => ({
            userId: r.userId,
            message: r.message,
            createdAt: r.createdAt.toISOString(),
            user: r.user,
          }))}
        />
      )}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[190px_minmax(0,1fr)_230px]">
      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
        {/* Channels — real slices of this group's feed */}
        <nav aria-label="Group channels" className="card flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-20 lg:flex-col">
          {(
            [
              { v: "all", label: "# feed", count: feed.length },
              { v: "media", label: "# media", count: mediaPosts.length },
              { v: "polls", label: "# polls", count: pollPosts.length },
            ] as const
          ).map((c) => (
            <Link
              key={c.v}
              href={viewHref(c.v)}
              aria-current={activeView === c.v ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeView === c.v
                  ? "bg-surface-hover text-ink"
                  : "text-ink-muted hover:bg-surface-hover/60 hover:text-ink"
              }`}
            >
              <span className="text-ink-faint">#</span>
              <span className="truncate">{c.label.slice(2)}</span>
              <span className="ml-auto font-mono text-[11px] text-ink-faint">
                {c.count}
              </span>
            </Link>
          ))}
        </nav>
        <RulesCard
          groupId={group.id}
          rules={(group as { rules?: string | null }).rules ?? null}
          canEdit={isOwner}
        />
        </div>

        {/* Center feed */}
        <div className="min-w-0">
        {/* ── Pinned highlights (moderator-curated) ── */}
        {activeView === "all" && pinned.length > 0 && (
          <section aria-label="Pinned highlights" className="card mb-4 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              📌 Highlights
            </h2>
            <ul className="space-y-1">
              {pinned.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/community/${p.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface-hover/60"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {p.author?.name || "Someone"} · {p._count.comments}{" "}
                      {p._count.comments === 1 ? "reply" : "replies"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* ── Feed (filtered by channel) ── */}
        <div className="mb-3 flex items-center gap-1 text-sm">
          {(
            [
              { v: "new", label: "New" },
              { v: "best", label: "Best" },
            ] as const
          ).map((s) => {
            const isActive =
              (s.v === "best") === (sortParam === "best");
            const params = new URLSearchParams();
            if (activeView !== "all") params.set("view", activeView);
            if (s.v === "best") params.set("sort", "best");
            const qs = params.toString();
            return (
              <Link
                key={s.v}
                href={`/groups/${slug}${qs ? `?${qs}` : ""}`}
                aria-current={isActive ? "true" : undefined}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  isActive
                    ? "bg-surface-hover text-ink"
                    : "text-ink-muted hover:bg-surface-hover/60 hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
        {!canView ? (
        <div className="card p-14 text-center">
          <p className="text-lg font-semibold">This group is private</p>
          <p className="mt-1 text-sm text-ink-muted">
            Join the group to see its posts.
          </p>
        </div>
      ) : visibleFeed.length === 0 ? (
        <div className="card p-14 text-center">
          <p className="text-lg font-semibold">
            {activeView === "all" ? "No posts yet" : `Nothing in #${activeView} yet`}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {activeView === "all"
              ? isMember
                ? "Be the first — post from the New Post page."
                : "Members haven't posted yet."
              : "Post in this group and it shows up here when it matches."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {visibleFeed.map((p) => (
            <GroupPostRow
              key={p.id}
              post={p}
              viewerId={meId}
              pinContext={canMod ? { groupId: group.id, canPin: true } : undefined}
            />
          ))}
        </div>
      )}
        </div>

        {/* Roster — owner crown, online first, kick for mods */}
        <aside className="card p-4 lg:sticky lg:top-20">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Members ({group._count.members})
            {onlineCount > 0 && (
              <span className="ml-2 normal-case text-emerald-500">
                {onlineCount} online
              </span>
            )}
          </h2>
          <ul className="space-y-1">
            {roster.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface-hover/60"
              >
                <span className="relative shrink-0">
                  {m.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.image}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                      {(m.user.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  {presence[m.userId]?.online && (
                    <span
                      aria-label="Online now"
                      title="Online now"
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface,#1a1a1c)] bg-emerald-400"
                    />
                  )}
                </span>
                <Link
                  href={`/profile/${m.user.id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline"
                >
                  {m.user.name || "Someone"}
                  {m.role === "owner" && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-accent">
                      ♛ owner
                    </span>
                  )}
                  {m.role === "moderator" && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-ink-faint">
                      mod
                    </span>
                  )}
                </Link>
                {(isOwner || (m.role === "moderator" && m.userId === meId)) && (
                  <MemberControls
                    groupId={group.id}
                    userId={m.userId}
                    role={m.role}
                    isOwner={isOwner}
                    isSelf={m.userId === meId}
                  />
                )}
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
        </aside>
      </div>
    </div>
  );
}

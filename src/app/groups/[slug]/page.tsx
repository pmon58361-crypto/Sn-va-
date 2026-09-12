import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMembership, canViewGroup } from "@/lib/groups";
import { getPosts } from "@/lib/queries";
import { getPresence } from "@/lib/presence";
import { GroupPostRow } from "@/components/groups/GroupPostRow";
import { GroupChat } from "@/components/groups/GroupChat";
import { GroupCover, GroupAvatar } from "@/components/groups/GroupCover";
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
  // schema — these are honest filters over what already exists), plus the
  // member chat room.
  const activeView =
    view === "media" || view === "polls" || view === "chat" ? view : "all";
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
  const ownerId =
    group.members.find((m) => m.role === "owner")?.user.id ||
    group.creator.id;

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

  // Initial chat history (members only, newest 50 shown oldest-first).
  const initialChatRows =
    activeView === "chat" && canView && isMember
      ? await prisma.message.findMany({
          where: { groupId: group.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            senderId: true,
            content: true,
            imageUrl: true,
            anonymous: true,
            createdAt: true,
            sender: { select: { id: true, name: true, image: true } },
          },
        })
      : [];
  const initialChat = initialChatRows
    .slice()
    .reverse()
    .map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5">
      {/* ── Group header: banner art, overlapping avatar, name + actions ── */}
      <section className="card overflow-hidden">
        {/* Real art gets the full stage; the fallback tile only needs
            a slim band — a tall empty gradient reads as broken. */}
        <div className={`w-full overflow-hidden ${group.coverUrl ? "h-44 sm:h-56" : "h-28 sm:h-36"} [&>div]:h-full [&>img]:h-full`}>
          <GroupCover name={group.name} coverUrl={group.coverUrl} />
        </div>

        <div className="p-5 pt-0">
          {/* Overlapping avatar tile — custom icon when set, letter fallback. */}
          <div className="relative z-10 -mt-10 mb-3 flex items-end">
            <GroupAvatar
              name={group.name}
              avatarUrl={group.avatarUrl}
              tileClassName="h-20 w-20 rounded-3xl text-3xl ring-4 ring-[var(--bg-surface,#1a1a1c)]"
            />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {group.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="badge shrink-0 bg-[var(--bg-soft)] text-xs capitalize text-ink-muted">
                  {group.visibility}
                </span>
                <span className="badge shrink-0 bg-[var(--bg-soft)] text-xs capitalize text-ink-muted">
                  {group.joinMode === "open" ? "Open" : "Approval"}
                </span>
                <span className="text-xs text-ink-faint">
                  {group._count.members}{" "}
                  {group._count.members === 1 ? "member" : "members"} ·{" "}
                  {group._count.posts}{" "}
                  {group._count.posts === 1 ? "post" : "posts"}
                  {onlineCount > 0 && (
                    <>
                      {" "}·{" "}
                      <span className="font-medium text-emerald-500">
                        {onlineCount} online
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isMember && (
                <>
                  <Link
                    href={`/new?group=${group.id}`}
                    className="btn-primary shrink-0 px-4 py-2 text-sm"
                  >
                    + Create Post
                  </Link>
                  <InviteButton slug={group.slug} />
                </>
              )}
              {!meId ? (
                <Link
                  href={`/auth/signin?callbackUrl=/groups/${group.slug}`}
                  className="btn-primary shrink-0 px-4 py-2 text-sm"
                >
                  Sign in to join
                </Link>
              ) : !isMember && (group.joinMode !== "open" || group.visibility !== "public") ? (
                // Approval groups — and private groups of any join mode, where
                // direct join is impossible — take tracked requests (no more
                // "DM the owner" dead-end).
                <div className="min-w-[220px]">
                  <JoinRequestButton
                    groupId={group.id}
                    hasPending={!!myRequest}
                  />
                </div>
              ) : (
                // Owners get roomier controls (the cramped shrink-0 column
                // squeezed Change/Remove/Delete into a dangling mess); everyone
                // else gets join.
                <div
                  className={
                    membership?.role === "owner"
                      ? "min-w-[220px]"
                      : "min-w-[200px]"
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
        </div>
      </section>

      {/* ── Server body: channels row · feed + right rail (stacks on mobile) ── */}
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
      {/* Channels — real slices of this group's feed, plus the member
          chat room. Hidden while the group is completely empty and chatless:
          nothing to slice, nothing to sort. */}
      {(feed.length > 0 || isMember) && (
        <nav aria-label="Group channels" className="card mt-5 flex gap-1 overflow-x-auto p-2">
        {(
          [
            { v: "all", label: "# feed", count: feed.length },
            { v: "media", label: "# media", count: mediaPosts.length },
            { v: "polls", label: "# polls", count: pollPosts.length },
            ...(isMember ? [{ v: "chat", label: "# chat", count: null } as const] : []),
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
            {c.count !== null && c.count !== undefined && (
              <span className="ml-auto font-mono text-[11px] text-ink-faint">
                {c.count}
              </span>
            )}
          </Link>
        ))}
      </nav>
      )}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* Center feed */}
        <div className="min-w-0">
        {/* ── Pinned highlights (moderator-curated) ── */}
        {activeView === "all" && pinned.length > 0 && (
          <section aria-label="Pinned highlights" className="card mb-4 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              📌 Highlights
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {pinned.map((p) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  className="w-52 shrink-0 rounded-2xl border border-line bg-soft p-3 transition hover:border-line-strong"
                >
                  <span className="block line-clamp-3 min-h-[3.75rem] text-sm font-semibold leading-snug text-ink">
                    {p.title}
                  </span>
                  <span className="mt-2 block truncate text-xs text-ink-faint">
                    {p.author?.name || "Someone"} · {p._count.comments}{" "}
                    {p._count.comments === 1 ? "reply" : "replies"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* ── Member chat room ── */}
        {activeView === "chat" &&
          (isMember && meId ? (
            <GroupChat slug={slug} meId={meId} initial={initialChat} />
          ) : (
            <div className="card p-14 text-center">
              <p className="text-lg font-semibold">Members only</p>
              <p className="mt-1 text-sm text-ink-muted">
                Join the group to chat with its members.
              </p>
            </div>
          ))}
        {/* ── Feed (filtered by channel) ── */}
        {activeView !== "chat" && (
          <>
        {feed.length > 0 && (
          <div className="mb-3 flex items-center gap-1 text-sm">
            <span className="px-1 text-xs text-ink-faint">Sort:</span>
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
        )}
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
            {activeView === "all" ? (
              isMember ? (
                <>
                  Be the first —{" "}
                  <Link
                    href={`/new?group=${group.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    post to this group
                  </Link>
                  .
                </>
              ) : (
                "Members haven't posted yet."
              )
            ) : (
              "Post in this group and it shows up here when it matches."
            )}
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
          </>
        )}
        </div>

        {/* Right rail: about · rules · roster */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:self-start">
        <section aria-label="About this group" className="card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            About
          </h2>
          {group.description ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
              {group.description}
            </p>
          ) : (
            <p className="text-sm text-ink-faint">
              No description yet.
            </p>
          )}
          <dl className="mt-3 space-y-1.5 text-xs text-ink-muted">
            <div className="flex items-center justify-between gap-2">
              <dt>Created</dt>
              <dd className="font-medium text-ink-soft">
                {new Date(group.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Visibility</dt>
              <dd className="font-medium capitalize text-ink-soft">
                {group.visibility}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Owner</dt>
              <dd className="font-medium text-ink-soft">
                {ownerId ? (
                  <Link href={`/profile/${ownerId}`} className="hover:underline">
                    {ownerName || "unknown"}
                  </Link>
                ) : (
                  ownerName || "unknown"
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <p className="text-base font-extrabold text-ink">
                {group._count.members}
              </p>
              <p className="text-[11px] text-ink-faint">Members</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-ink">
                {group._count.posts}
              </p>
              <p className="text-[11px] text-ink-faint">Posts</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-emerald-500">
                {onlineCount}
              </p>
              <p className="text-[11px] text-ink-faint">Online</p>
            </div>
          </div>
        </section>
        <RulesCard
          groupId={group.id}
          rules={(group as { rules?: string | null }).rules ?? null}
          canEdit={isOwner}
        />
        {/* Roster — owner crown, online first, kick for mods */}
        <section className="card p-4">
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
        </section>
        </div>
      </div>
    </div>
  );
}

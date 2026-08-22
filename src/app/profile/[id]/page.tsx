import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFollowing } from "@/lib/social";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";
import { MapPinIcon, MailIcon, CalendarIcon, SettingsIcon } from "@/components/ui/Icons";
import { CATEGORY_META } from "@/lib/types";
import { Highlights } from "./Highlights";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [user, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        settings: true,
        posts: {
          orderBy: { createdAt: "desc" },
          include: {
            images: {
              select: { id: true, url: true, order: true },
              orderBy: { order: "asc" },
            },
            _count: { select: { comments: true, reactions: true } },
          },
        },
          _count: {
            select: { posts: true, followers: true, following: true },
          },
      },
    }),
    auth(),
  ]);

  if (!user) notFound();

  const settings = user.settings;
  const isPublic = settings?.publicProfile ?? true;
  const isOwner = session?.user?.id === user.id;

  // Private profiles show nothing but the identity card to other viewers —
  // no bio, location, email, stats, or posts.
  if (!isPublic && !isOwner) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="card p-12 text-center">
          <div className="mb-4 flex justify-center">
            <Avatar name={user.name} image={user.image} size={88} />
          </div>
          <h1 className="text-xl font-bold text-ink">
            {user.name || "Anonymous"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">This profile is private.</p>
        </div>
      </div>
    );
  }

  const viewerIsFollowing = await isFollowing(session?.user?.id, user.id);
  const highlightRows = await prisma.highlight.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { id: true, imageUrl: true } } },
  });
  const highlights = highlightRows.map((h) => ({
    id: h.id,
    title: h.title,
    coverUrl: h.coverUrl,
    items: h.items,
  }));
  const joinDate = new Date(user.createdAt).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  const handle = "@" + (user.email?.split("@")[0] || "user");
  const badges = deriveBadges(user.posts.map((p) => p.category));
  const reactionTotal = user.posts.reduce(
    (sum, p) => sum + p._count.reactions,
    0
  );

  // Real filter tabs — the active tab actually filters the grid below.
  const activeTab = ["posts", "work", "photos"].includes(tab || "")
    ? (tab as "posts" | "work" | "photos")
    : null;
  const filteredPosts = !activeTab
    ? user.posts
    : activeTab === "posts"
    ? user.posts.filter((p) => p.images.length === 0)
    : activeTab === "work"
    ? user.posts.filter(
        (p) => p.category === "JOB_OFFER" || p.category === "JOB_REQUEST"
      )
    : user.posts.filter((p) => p.images.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* ───────────── Profile header ───────────── */}
      <div className="pb-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
          {/* Avatar */}
          <div className="shrink-0">
            <Avatar name={user.name} image={user.image} size={120} />
          </div>

          {/* Identity + actions */}
          <div className="min-w-0 flex-1">
            {/* Name + edit button inline — no floating isolation */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-ink">
                  {user.name || "Anonymous"}
                </h1>
                <p className="text-sm text-ink-faint">{handle}</p>
              </div>
              {isOwner ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/settings"
                    aria-label="Settings"
                    title="Settings"
                    className="btn-outline grid h-10 w-10 place-items-center px-0"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/archive"
                    className="btn-outline flex items-center justify-center gap-2 px-4 py-2 text-sm"
                  >
                    View archive
                  </Link>
                </div>
              ) : isPublic ? (
                <FollowButton
                  targetUserId={user.id}
                  following={viewerIsFollowing}
                />
              ) : (
                <span className="badge shrink-0 bg-accent-tint px-4 py-2 text-accent">
                  Member
                </span>
              )}
            </div>

            {/* Badges — activity-derived, not fake */}
            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="badge bg-soft text-xs text-ink-muted"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            {/* Bio — prominent, right under the handle */}
            {user.bio ? (
              <p className="mt-4 whitespace-pre-wrap text-center text-sm leading-relaxed text-ink-soft sm:text-left">
                {user.bio}
              </p>
            ) : isOwner ? (
              <p className="mt-4 text-center text-sm text-ink-faint sm:text-left">
                No bio yet.{" "}
                <Link href="/settings" className="text-accent hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : null}

            {/* Meta row */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-muted sm:justify-start">
              {user.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4" />
                  {user.location}
                </span>
              )}
              {settings?.showEmail && (
                <span className="inline-flex items-center gap-1.5">
                  <MailIcon className="h-4 w-4" />
                  {user.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" />
                Joined {joinDate}
              </span>
            </div>
          </div>
        </div>

        {/* Stats — larger numbers, lighter labels */}
        <div className="mt-8 flex items-center justify-center gap-10 border-y border-line py-5 sm:justify-start sm:gap-14">
          <Stat label="Posts" value={user._count.posts} />
          <Stat label="Following" value={user._count.following} />
          <Stat label="Followers" value={user._count.followers} />
          <Stat label="Reactions" value={reactionTotal} />
        </div>
      </div>

      {/* Highlights row (Instagram-style circles) */}
      <Highlights userId={user.id} isOwner={isOwner} highlights={highlights} />

      {/* ───────────── Content ───────────── */}
      {user.posts.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-sm text-ink-muted">
            {isOwner
              ? "You haven't posted yet. Share something with the community."
              : "No posts yet."}
          </p>
          {isOwner && (
            <Link href="/new" className="btn-primary mt-5">
              Create a post
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Filter bar — tabs are links that really filter */}
          <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-line pb-px">
            <FilterTab
              label="All"
              count={user.posts.length}
              active={!activeTab}
              href={`/profile/${id}`}
            />
            <FilterTab
              label="Posts"
              count={user.posts.filter((p) => p.images.length === 0).length}
              active={activeTab === "posts"}
              href={`/profile/${id}?tab=posts`}
            />
            <FilterTab
              label="Work"
              count={
                user.posts.filter(
                  (p) => p.category === "JOB_OFFER" || p.category === "JOB_REQUEST"
                ).length
              }
              active={activeTab === "work"}
              href={`/profile/${id}?tab=work`}
            />
            <FilterTab
              label="Photos"
              count={user.posts.filter((p) => p.images.length > 0).length}
              active={activeTab === "photos"}
              href={`/profile/${id}?tab=photos`}
            />
          </div>

          {filteredPosts.length === 0 ? (
            <div className="card p-16 text-center">
              <p className="text-sm text-ink-muted">Nothing in this tab yet.</p>
            </div>
          ) : (
            <PostGrid posts={filteredPosts} />
          )}
        </>
      )}
    </div>
  );
}

// ── Stats: big number, tiny label ──
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink-faint">
        {label}
      </div>
    </div>
  );
}

// ── Filter tab ──
function FilterTab({
  label,
  count,
  active = false,
  href,
}: {
  label: string;
  count: number;
  active?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "text-ink"
          : "text-ink-muted hover:text-ink-soft"
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 text-xs text-ink-faint">{count}</span>
      )}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-accent" />
      )}
    </Link>
  );
}

// ── Activity-derived badges. No fake roles — earned from what you post. ──
function deriveBadges(categories: string[]): string[] {
  const set = new Set<string>();
  for (const c of categories) {
    if (c === "COMMUNITY") set.add("Community");
    if (c === "JOB_OFFER") set.add("Creator");
    if (c === "JOB_REQUEST") set.add("Collaborator");
    if (c === "JOB_LISTING") set.add("Recruiter");
  }
  return Array.from(set);
}

type GridPost = {
  id: string;
  title: string;
  category: string;
  images: { id: string; url: string; order: number }[];
};

// Detail pages live in different sections per category — linking everything
// to /community would 404 job posts.
function postHref(p: GridPost): string {
  const meta = CATEGORY_META[p.category as keyof typeof CATEGORY_META];
  return `/${meta?.section || "community"}/${p.id}`;
}

function PostGrid({ posts }: { posts: GridPost[] }) {
  const withImages = posts.filter((p) => p.images.length > 0);
  const textOnly = posts.filter((p) => p.images.length === 0);

  return (
    <div className="space-y-8">
      {withImages.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {withImages.map((p) => (
            <Link
              key={p.id}
              href={postHref(p)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.images[0].url}
                alt={p.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <p className="absolute bottom-0 left-0 right-0 truncate p-3 text-xs font-medium text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {p.title}
              </p>
            </Link>
          ))}
        </div>
      )}

      {textOnly.length > 0 && (
        <div className="space-y-3">
          {textOnly.map((p) => (
            <Link
              key={p.id}
              href={postHref(p)}
              className="card card-hover block p-5"
            >
              <h3 className="text-base font-semibold text-ink group-hover:text-accent">
                {p.title}
              </h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}





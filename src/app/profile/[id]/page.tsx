import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFollowing } from "@/lib/social";
import { absoluteUrl } from "@/lib/og";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";
import {
  MapPinIcon,
  MailIcon,
  CalendarIcon,
  SettingsIcon,
  PlusIcon,
  BookIcon,
} from "@/components/ui/Icons";
import { CATEGORY_META } from "@/lib/types";
import { cdnUrl } from "@/lib/cdn";
import { Highlights } from "./Highlights";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      name: true,
      bio: true,
      image: true,
      deactivatedAt: true,
      settings: { select: { publicProfile: true } },
    },
  });
  // Private profiles get no rich preview — that's the point of private.
  if (!user || user.settings?.publicProfile === false) return {};
  // Deactivated accounts get no rich preview either.
  if (user.deactivatedAt) return {};

  const name = user.name || "Someone";
  const description = user.bio?.slice(0, 160) || "On Snívať — dream, grow, connect.";
  const image = absoluteUrl(user.image);
  return {
    title: `${name} — Snívať`,
    description,
    openGraph: {
      title: name,
      description,
      images: image ? [{ url: image }] : undefined,
      type: "profile",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

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

  // Deactivated accounts show only a quiet notice to everyone but the owner
  // (the owner reads as signed out anyway — this covers stale sessions).
  if (user.deactivatedAt && !isOwner) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="card p-12 text-center">
          <p className="text-sm text-ink-muted">
            This account has been deactivated.
          </p>
        </div>
      </div>
    );
  }

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

  // Independent reads — single round-trip wave.
  const [viewerIsFollowing, highlightRows] = await Promise.all([
    isFollowing(session?.user?.id, user.id),
    prisma.highlight.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { id: true, imageUrl: true } } },
    }),
  ]);
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
  // Moderation: visitors don't see hidden posts on a profile; the owner does
  // (so they can fix or delete them). Admins see everything.
  const visiblePosts = isOwner || session?.user?.role === "admin"
    ? user.posts
    : user.posts.filter((p) => !p.hidden);
  const badges = deriveBadges(visiblePosts.map((p) => p.category));
  const reactionTotal = visiblePosts.reduce(
    (sum, p) => sum + p._count.reactions,
    0
  );

  // Real filter tabs — the active tab actually filters the grid below.
  const activeTab = ["posts", "work", "photos"].includes(tab || "")
    ? (tab as "posts" | "work" | "photos")
    : null;
  const filteredPosts = !activeTab
    ? visiblePosts
    : activeTab === "posts"
    ? visiblePosts.filter((p) => p.images.length === 0)
    : activeTab === "work"
    ? visiblePosts.filter(
        (p) => p.category === "JOB_OFFER" || p.category === "JOB_REQUEST"
      )
    : visiblePosts.filter((p) => p.images.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* ───────────── Profile header card ───────────── */}
      <section className="card overflow-hidden">
        {/* Soft accent-tinted banner */}
        <div
          className="h-24 w-full"
          style={{
            background: `linear-gradient(120deg, rgba(var(--accent-rgb), 0.22) 0%, transparent 55%), var(--bg-elevated)`,
          }}
        />

        <div className="px-5 pb-5 sm:px-6">
          {/* Avatar overlapping the banner */}
          <div className="-mt-12 mb-4">
            <span className="inline-block rounded-full border-4 border-[var(--bg-elevated)] shadow-lg">
              <Avatar name={user.name} image={user.image} size={96} />
            </span>
          </div>

          {/* Name + handle | actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold leading-tight text-ink">
                {user.name || "Anonymous"}
              </h1>
              <p className="mt-0.5 text-sm text-ink-faint">{handle}</p>

              {/* Badges — activity-derived, not fake */}
              {badges.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="badge bg-accent/10 text-xs text-accent"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isOwner ? (
                <>
                  <Link
                    href="/bookmarks"
                    aria-label="Saved posts"
                    title="Saved posts"
                    className="btn-outline grid h-10 w-10 place-items-center px-0"
                  >
                    <BookIcon className="h-4 w-4" />
                  </Link>
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
                </>
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
          </div>

          {/* Bio — prominent, left-aligned under identity */}
          {user.bio ? (
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
              {user.bio}
            </p>
          ) : isOwner ? (
            <p className="mt-4 text-sm text-ink-faint">
              No bio yet.{" "}
              <Link href="/settings" className="text-accent hover:underline">
                Add one
              </Link>
              .
            </p>
          ) : null}

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
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

        {/* Stats strip — divided footer of the header card */}
        <div className="grid grid-cols-2 divide-x divide-y divide-line border-t border-line bg-[var(--bg-soft)] py-4 sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Posts" value={user._count.posts} />
          <Stat label="Following" value={user._count.following} />
          <Stat label="Followers" value={user._count.followers} />
          <Stat label="Reactions" value={reactionTotal} />
        </div>
      </section>

      {/* Highlights row (Instagram-style circles) */}
      <Highlights userId={user.id} isOwner={isOwner} highlights={highlights} />

      {/* ───────────── Content ───────────── */}
      {visiblePosts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <PlusIcon className="h-6 w-6" />
          </span>
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
          <div className="mb-5 mt-7 flex items-center gap-1 overflow-x-auto border-b border-line pb-px">
            <FilterTab
              label="All"
              count={visiblePosts.length}
              active={!activeTab}
              href={`/profile/${id}`}
            />
            <FilterTab
              label="Posts"
              count={visiblePosts.filter((p) => p.images.length === 0).length}
              active={activeTab === "posts"}
              href={`/profile/${id}?tab=posts`}
            />
            <FilterTab
              label="Work"
              count={
                visiblePosts.filter(
                  (p) => p.category === "JOB_OFFER" || p.category === "JOB_REQUEST"
                ).length
              }
              active={activeTab === "work"}
              href={`/profile/${id}?tab=work`}
            />
            <FilterTab
              label="Photos"
              count={visiblePosts.filter((p) => p.images.length > 0).length}
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

// ── Stat cell inside the divided strip ──
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold tabular-nums text-ink">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-ink-faint">
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
        <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-accent" />
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
  createdAt: Date;
  images: { id: string; url: string; order: number }[];
};

// Detail pages live in different sections per category — linking everything
// to /community would 404 job posts.
function postHref(p: GridPost): string {
  const meta = CATEGORY_META[p.category as keyof typeof CATEGORY_META];
  return `/${meta?.section || "community"}/${p.id}`;
}

function relativeDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
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
                src={cdnUrl(p.images[0].url, 480)}
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
          {textOnly.map((p) => {
            const meta =
              CATEGORY_META[p.category as keyof typeof CATEGORY_META];
            return (
              <Link
                key={p.id}
                href={postHref(p)}
                className="card card-hover group block p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate text-base font-semibold text-ink transition-colors group-hover:text-accent">
                    {p.title}
                  </h3>
                  <span className="badge shrink-0 bg-accent/10 text-xs text-accent">
                    {meta?.label || p.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {relativeDate(p.createdAt)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

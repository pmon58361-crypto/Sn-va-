import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPresence } from "@/lib/presence";
import { isFoundingMember } from "@/lib/founding";
import { isFollowing } from "@/lib/social";
import { absoluteUrl } from "@/lib/og";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";
import {
  MapPinIcon,
  MailIcon,
  CalendarIcon,
  CameraIcon,
  BookIcon,
  HeartIcon,
  MessageIcon,
} from "@/components/ui/Icons";
import { CATEGORY_META } from "@/lib/types";
import { cdnUrl } from "@/lib/cdn";
import { getStreak } from "@/lib/streak";
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
    // Root layout template appends "· Snívať".
    title: name,
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
            // Polls surface on grid cells as a compact strip (full voting
            // stays on the post detail page).
            polls: {
              select: {
                id: true,
                question: true,
                _count: { select: { votes: true } },
              },
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
  const isAdmin = session?.user?.role === "admin";

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
  // no bio, location, email, stats, or posts. Admins bypass the wall for
  // moderation review.
  if (!isPublic && !isOwner && !isAdmin) {
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
  const [viewerIsFollowing, highlightRows, activeStoryRow, presence, founding] =
    await Promise.all([
      isFollowing(session?.user?.id, user.id),
      prisma.highlight.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        include: { items: { select: { id: true, imageUrl: true } } },
      }),
      // Drives the gradient ring on the avatar — same live-window rule as rail.
      prisma.story.findFirst({
        where: { authorId: id, expiresAt: { gt: new Date() } },
        select: { id: true },
      }),
      Promise.resolve(getPresence([id])),
      isFoundingMember(user.id, user.createdAt),
    ]);
  const hasActiveStory = !!activeStoryRow;
  const mePresence = !isOwner ? presence[id] : null;
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
  // Privacy-safe handle: derived from the DISPLAY NAME, never the email —
  // the old email-local-part handle leaked addresses on every profile.
  const handle =
    "@" +
    ((user.name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "")
       .slice(0, 24) || "member");
  // Derived streak — real actions only (post/comment/reaction), public data.
  const streak = await getStreak(user.id);
  // Moderation: visitors don't see hidden posts on a profile; the owner does
  // (so they can fix or delete them). Admins see everything.
  const visiblePosts = isOwner || session?.user?.role === "admin"
    ? user.posts
    : user.posts.filter((p) => !p.hidden);
  const badges = deriveBadges(visiblePosts.map((p) => p.category));

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
      {/* ───────────── Profile header (IG anatomy) ─────────────
          One flow, all breakpoints: avatar left, identity right, bio/meta
          full-width below. No banner, no mobile/desktop content forks. */}
      <section className="px-1 py-2 sm:px-2">
        {/* Tracks sized to the RINGED avatar (img + padding + border):
            96px mobile / 160px desktop. The !important img overrides beat
            Avatar's inline width/height style — plain classes lose to
            inline styles, which is what blew the avatar up at 630px. */}
        <div className="flex items-start gap-5 sm:gap-8">
          {/* Avatar — 80px phones / 144px desktop; ring kept */}
          <div className="shrink-0 [&_img]:!h-20 [&_img]:!w-20 sm:[&_img]:!h-36 sm:[&_img]:!w-36">
            {hasActiveStory ? (
              <span className="inline-block rounded-full bg-gradient-to-tr from-accent to-like p-[3px] sm:p-[4px]">
                <span className="inline-block rounded-full border-2 border-[var(--bg-elevated)] shadow-lg sm:border-[3px]">
                  <Avatar name={user.name} image={user.image} size={140} />
                </span>
              </span>
            ) : (
              <span className="inline-block rounded-full border-2 border-line-strong shadow-lg">
                <Avatar name={user.name} image={user.image} size={144} />
              </span>
            )}
          </div>

          {/* Identity column — ONE copy for every breakpoint: name,
              handle, presence, chips, stats. */}
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold leading-tight text-ink sm:text-2xl">
              {user.name || "Anonymous"}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-faint">
              <span className="truncate">{handle}</span>
              {mePresence?.online && (
                <>
                  <span
                    aria-label="Online now"
                    title="Online now"
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                  />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Online{mePresence.page ? ` · ${mePresence.page}` : ""}
                  </span>
                </>
              )}
            </p>
            {(founding || streak.current > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {founding && (
                  <span
                    title="Founding Member — first 500 accounts"
                    className="badge bg-accent-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                  >
                    ★ Founding
                  </span>
                )}
                {streak.current > 0 && (
                  <span
                    title={`${streak.current}-day activity streak`}
                    className="badge bg-accent-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                  >
                    🔥 {streak.current}d
                  </span>
                )}
              </div>
            )}
            <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-muted">
              <span className="whitespace-nowrap">
                <b className="font-bold text-ink">{visiblePosts.length}</b>{" "}
                {visiblePosts.length === 1 ? "post" : "posts"}
              </span>
              <span className="whitespace-nowrap">
                <b className="font-bold text-ink">
                  {user._count.followers}
                </b>{" "}
                {user._count.followers === 1 ? "follower" : "followers"}
              </span>
              <span className="whitespace-nowrap">
                <b className="font-bold text-ink">
                  {user._count.following}
                </b>{" "}
                following
              </span>
            </p>
          </div>
        </div>

        {/* Bio / badges / meta / completion — full-width below the
            avatar row on every breakpoint (IG puts bio under the name;
            full-width is cleaner on phones and identical on desktop). */}
        <div className="mt-4 min-w-0">

            {/* Goal-gradient onboarding: gifted first stamp ("Joined") plus
                five real checks. Owner-only, collapses forever at 6/6. */}
            {isOwner &&
              (() => {
                const steps = [
                  { label: "Joined Snívať", done: true },
                  { label: "Add a photo", done: !!user.image },
                  { label: "Write a bio", done: !!user.bio?.trim() },
                  { label: "Add your location", done: !!user.location?.trim() },
                  {
                    label: "Publish your first post",
                    done: user._count.posts > 0,
                  },
                  {
                    label: "Follow someone",
                    done: user._count.following > 0,
                  },
                ];
                const done = steps.filter((s) => s.done).length;
                if (done >= steps.length) return null;
                const pct = Math.round((done / steps.length) * 100);
                return (
                  <div className="card mt-4 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-ink">
                        Finish your profile
                      </p>
                      <p className="font-mono text-xs text-ink-faint">
                        {done} of {steps.length}
                      </p>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"
                      role="progressbar"
                      aria-valuenow={done}
                      aria-valuemin={0}
                      aria-valuemax={steps.length}
                      aria-label={`${done} of ${steps.length} profile steps complete`}
                    >
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {steps.map((s) => (
                        <li
                          key={s.label}
                          className={`text-xs ${s.done ? "font-medium text-accent" : "text-ink-muted"}`}
                        >
                          {s.done ? "✓ " : "○ "}
                          {s.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

            {/* Earned badges — activity-derived, not fake */}
            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
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

            {/* Bio — break-words stops long words painting over neighbours */}
            {user.bio ? (
              <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-soft">
                {user.bio}
              </p>
            ) : isOwner ? (
              <p className="mt-3 text-sm text-ink-faint">
                No bio yet.{" "}
                <Link href="/settings" className="text-accent hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : null}

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              {user.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4" />
                  {user.location}
                </span>
              )}
              {/* Email is owner-only — never rendered on public profiles,
                  regardless of the retired showEmail preference. */}
              {isOwner && user.email && (
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

        {/* Action row — full-width buttons, IG style; sits right under the
            bio/meta on mobile */}
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 sm:mt-5">
          {isOwner ? (
            <>
              <Link
                href="/settings"
                className="btn-outline flex flex-1 items-center justify-center px-4 py-2 text-sm"
              >
                Edit profile
              </Link>
              <Link
                href="/archive"
                className="btn-outline flex flex-1 items-center justify-center px-4 py-2 text-sm"
              >
                View archive
              </Link>
              <Link
                href="/bookmarks"
                aria-label="Saved posts"
                title="Saved posts"
                className="btn-outline grid h-10 w-10 shrink-0 place-items-center px-0"
              >
                <BookIcon className="h-4 w-4" />
              </Link>
            </>
          ) : isPublic ? (
            <>
              <FollowButton
                targetUserId={user.id}
                following={viewerIsFollowing}
                className="!flex-1 !py-2 text-center"
              />
              <Link
                href={`/dm/${user.id}`}
                className="btn-outline flex shrink-0 items-center justify-center gap-2 px-5 py-2 text-sm"
              >
                <MessageIcon className="h-4 w-4" />
                Message
              </Link>
            </>
          ) : (
            <span className="badge bg-accent-tint px-4 py-2 text-accent">
              Member
            </span>
          )}
        </div>
      </section>

      {/* Highlights row (Instagram-style circles) */}
      <Highlights userId={user.id} isOwner={isOwner} highlights={highlights} />

      {/* ───────────── Content ───────────── */}
      {visiblePosts.length === 0 ? (
        <div className="mt-6 px-6 py-14 text-center">
          <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full border-2 border-ink-faint text-ink-faint">
            <CameraIcon className="h-8 w-8" />
          </span>
          <p className="text-2xl font-black tracking-tight text-ink">
            {isOwner ? "Share photos" : "No posts yet"}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">
            {isOwner
              ? "When you share posts, they will appear on your profile."
              : `Follow so you don't miss ${
                  user.name ? `${user.name}'s` : "their"
                } first.`}
          </p>
          {isOwner && (
            <Link
              href="/new"
              className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
            >
              Share your first post
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
              <p className="text-sm text-ink-muted">
                {activeTab === "work"
                  ? "No work posted yet — offers and requests will show up here."
                  : activeTab === "photos"
                  ? "No photos yet — posts with images land in this grid."
                  : "No text posts yet."}
              </p>
            </div>
          ) : (
            <PostGrid posts={filteredPosts} />
          )}
        </>
      )}
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
  polls?: { id: string; question: string; _count: { votes: number } }[];
  _count?: { comments: number; reactions: number };
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

// IG-style uniform square grid — every post is one cell. Image posts show
// their first photo; text posts get a styled mini-card. Hover/focus reveals
// real engagement counts (reactions · comments).
function PostGrid({ posts }: { posts: GridPost[] }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {posts.map((p) => {
        const meta = CATEGORY_META[p.category as keyof typeof CATEGORY_META];
        const img = p.images[0];
        return (
          <Link
            key={p.id}
            href={postHref(p)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-soft"
          >
            {img ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cdnUrl(img.url, 480)}
                  alt={p.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {p.polls?.[0] && (
                  <span className="absolute bottom-1.5 left-1.5 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                    📊 {p.polls[0]._count.votes}
                  </span>
                )}
              </>
            ) : (
              <span className="absolute inset-0 flex flex-col justify-between bg-surface p-3 text-left">
                <span className="badge w-fit bg-accent/10 text-[10px] uppercase tracking-wide text-accent">
                  {meta?.label || p.category}
                </span>
                <span
                  className="text-sm font-semibold leading-snug text-ink"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.title}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {relativeDate(p.createdAt)}
                  {p.polls?.[0] && (
                    <>
                      {" "}· 📊 {p.polls[0]._count.votes}{" "}
                      {p.polls[0]._count.votes === 1 ? "vote" : "votes"}
                    </>
                  )}
                </span>
              </span>
            )}
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-5 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <HeartIcon className="h-5 w-5" />
                {p._count?.reactions ?? 0}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <MessageIcon className="h-5 w-5" />
                {p._count?.comments ?? 0}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

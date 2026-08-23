import { getPosts, getTopTags } from "@/lib/queries";
import { PostCard, EmptyState } from "@/components/posts/PostCard";
import { QuickComposer } from "@/components/posts/QuickComposer";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { InterestPickerModal } from "@/components/onboarding/InterestPickerModal";
import { getActiveStories } from "@/lib/stories";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Community — Snívať" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; before?: string }>;
}) {
  const { q, tab, before } = await searchParams;
  const session = await auth();
  const meId = session?.user?.id;
  const isFollowing = tab === "following";

  // Cursor for chronological Load more.
  const beforeDate = before ? new Date(before) : undefined;
  const validBefore =
    beforeDate && !isNaN(beforeDate.getTime()) ? beforeDate : undefined;

  // "Following" is strictly the people I follow — my own posts stay out
  // (IG/Twitter convention; they live on my profile and in For you).
  let authorIds: string[] | undefined;
  if (isFollowing && meId) {
    const rows = await prisma.follow.findMany({
      where: { followerId: meId },
      select: { followingId: true },
    });
    authorIds = [meId, ...rows.map((r) => r.followingId)];
  }

  const [posts, storyGroups, topTags, settings] = await Promise.all([
    getPosts({
      category: "COMMUNITY",
      search: q,
      viewerId: meId,
      authorIds,
      before: validBefore,
      limit: PAGE_SIZE,
      sort: isFollowing || validBefore ? "new" : "best",
    }),
    getActiveStories(meId),
    getTopTags(24),
    meId
      ? prisma.settings.findUnique({
          where: { userId: meId },
          select: { interests: true },
        })
      : Promise.resolve(null),
  ]);

  // Once-per-user onboarding: interests === null means never asked.
  // Answering or skipping writes "" so it never resurfaces.
  const showInterestPicker =
    !!meId && !q && !validBefore && settings?.interests == null;

  // Tab links preserve an active search.
  const tabHref = (t: string) =>
    `/community?${new URLSearchParams({ ...(q ? { q } : {}), ...(t === "following" ? { tab: t } : {}) })}`;

  // Guard: an empty pool (fresh instance, narrow search, all-hidden) has no
  // last post - building the cursor eagerly threw before EmptyState rendered.
  const loadMoreParams =
    posts.length > 0
      ? new URLSearchParams({
          ...(q ? { q } : {}),
          ...(isFollowing ? { tab: "following" } : {}),
          before: new Date(posts[posts.length - 1].createdAt).toISOString(),
        })
      : null;

  return (
    <div className="flex">
      {showInterestPicker && <InterestPickerModal suggestions={topTags.map(([t]) => t)} />}
      {/* Center feed */}
      <div className="mx-auto w-full max-w-[640px] px-4 py-5">
        {/* Stories rail */}
        <StoriesBar groups={storyGroups} meId={session?.user?.id} />

        <div className="h-4" />

        {/* Composer */}
        <QuickComposer />

        {/* Feed tabs */}
        <div className="mt-4 grid grid-cols-2 border-b border-line">
          <Link
            href={!isFollowing ? "/community" : tabHref("foryou")}
            aria-current={!isFollowing ? "page" : undefined}
            className={`relative py-2.5 text-center text-sm font-bold transition-colors ${
              !isFollowing ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            For you
            {!isFollowing && (
              <span className="absolute inset-x-8 bottom-0 h-0.5 bg-accent" />
            )}
          </Link>
          <Link
            href={tabHref("following")}
            aria-current={isFollowing ? "page" : undefined}
            className={`relative py-2.5 text-center text-sm font-bold transition-colors ${
              isFollowing ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            Following
            {isFollowing && (
              <span className="absolute inset-x-8 bottom-0 h-0.5 bg-accent" />
            )}
          </Link>
        </div>

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={
                q
                  ? "No posts match your search"
                  : isFollowing
                  ? "Your following feed is quiet"
                  : "Be the first here"
              }
              description={
                q
                  ? "Try a different keyword."
                  : isFollowing
                  ? "Follow people whose work you want to see — try the Who to follow panel."
                  : "This feed is quiet for now. Share something — a win, a question, a work-in-progress."
              }
              action={
                !q && isFollowing ? (
                  <Link href="/people" className="btn-primary">
                    Find people
                  </Link>
                ) : !q ? (
                  <Link href="/new" className="btn-primary">
                    Share a post
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} viewerId={session?.user?.id} showFeedback />
              ))}
            </div>

            {/* Load more — honest pagination, no infinite-scroll tricks */}
            {posts.length >= PAGE_SIZE && loadMoreParams && (
              <Link
                href={`/community${loadMoreParams.toString() ? `?${loadMoreParams}` : ""}`}
                className="mt-6 block rounded-xl border border-line bg-surface py-3 text-center text-sm font-medium text-ink-muted transition hover:border-accent hover:text-accent"
              >
                Load older posts
              </Link>
            )}
          </>
        )}
      </div>

      {/* Right sidebar */}
      <RightSidebar viewerId={session?.user?.id} />
    </div>
  );
}

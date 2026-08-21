import { getPosts } from "@/lib/queries";
import { PostCard, EmptyState } from "@/components/posts/PostCard";
import { QuickComposer } from "@/components/posts/QuickComposer";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { getActiveStories } from "@/lib/stories";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Community — Snívať" };
export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [posts, session] = await Promise.all([
    getPosts({ category: "COMMUNITY", search: q }),
    auth(),
  ]);

  const storyGroups = await getActiveStories(session?.user?.id);

  // Real tags from DB for the topic chip row
  const taggedPosts = await prisma.post.findMany({
    take: 100,
    where: { tags: { not: null }, status: "open" },
    select: { tags: true },
  });
  const tagCounts = new Map<string, number>();
  for (const p of taggedPosts) {
    if (!p.tags) continue;
    for (const t of p.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="flex">
      {/* Center feed */}
      <div className="mx-auto w-full max-w-[640px] px-4 py-5">
        {/* Stories rail */}
        <StoriesBar groups={storyGroups} meId={session?.user?.id} />

        <div className="h-4" />

        {/* Composer */}
        <QuickComposer />

        {/* Topic chips — real tags only */}
        {topTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {!q && (
              <Link
                href="/community"
                className="badge bg-accent/10 text-xs font-medium text-accent"
              >
                All
              </Link>
            )}
            {q && (
              <Link
                href="/community"
                className="badge bg-soft text-xs font-medium text-ink-muted hover:text-accent"
              >
                All
              </Link>
            )}
            {topTags.map(([tag]) => (
              <Link
                key={tag}
                href={`/community?q=${encodeURIComponent(tag)}`}
                className={`badge text-xs font-medium transition ${
                  q === tag
                    ? "bg-accent/10 text-accent"
                    : "bg-soft text-ink-muted hover:text-accent"
                }`}
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={q ? "No posts match your search" : "Be the first here"}
              description={
                q
                  ? "Try a different keyword."
                  : "This feed is quiet for now. Share something — a win, a question, a work-in-progress."
              }
              action={
                !q && (
                  <Link href="/new" className="btn-primary">
                    Share a post
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} viewerId={session?.user?.id} />
            ))}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <RightSidebar />
    </div>
  );
}


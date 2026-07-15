import { getPosts } from "@/lib/queries";
import { PostCard, EmptyState } from "@/components/posts/PostCard";
import { SectionHeader } from "@/components/posts/SectionHeader";
import { auth } from "@/auth";
import Link from "next/link";

export const metadata = { title: "Job Applications — Snívať" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [posts, session] = await Promise.all([
    getPosts({ category: "JOB_LISTING", search: q }),
    auth(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <SectionHeader
        eyebrow="Applications"
        title="Take the next step."
        description="Open positions, applied to in one breath. The friction between you and what's next — removed."
        href="/new"
      />

      <form className="mb-8 flex gap-2" action="/applications" method="GET">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Search jobs by title, tag, or keyword…"
          className="input"
        />
        <button type="submit" className="btn-outline shrink-0">
          Search
        </button>
      </form>

      {posts.length === 0 ? (
        <EmptyState
          title={q ? "No jobs match your search" : "No open positions yet"}
          description={
            q
              ? "Try a different keyword."
              : "When employers post jobs, they'll show up here."
          }
          action={
            !q && (
              <Link href="/new" className="btn-primary">
                Post a job
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4 fade-in">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} viewerId={session?.user?.id} />
          ))}
        </div>
      )}
    </div>
  );
}

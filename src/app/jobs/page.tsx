import Link from "next/link";
import { getPosts } from "@/lib/queries";
import { PostCard, EmptyState } from "@/components/posts/PostCard";
import { SectionHeader } from "@/components/posts/SectionHeader";
import { OfferIcon, RequestIcon } from "@/components/ui/Icons";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Jobs — Snívať" };
export const dynamic = "force-dynamic";

// Two organic perspectives on the Jobs section:
//  - offers   -> people offering what they can do
//  - requests -> people looking for someone to do work
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;
  const isRequest = tab === "requests";
  const category = isRequest ? "JOB_REQUEST" : "JOB_OFFER";

  const session = await auth();
  const meId = session?.user?.id;

  // Tab badges are plain counts — fetching two full ranked feeds just to
  // read .length used to cost ~8 extra DB round trips here.
  const [posts, offerCount, requestCount] = await Promise.all([
    getPosts({ category, search: q, viewerId: meId }),
    prisma.post.count({ where: { category: "JOB_OFFER" } }),
    prisma.post.count({ where: { category: "JOB_REQUEST" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <SectionHeader
        eyebrow="Jobs"
        title={isRequest ? "Who needs your hands?" : "Who's offering what?"}
        description={
          isRequest
            ? "Real projects from people looking for someone to build them. Reach out directly."
            : "Skilled people, ready to work. Browse what they do and connect."
        }
        href="/new"
      />

      {/* Perspective toggle — segmented control, SVG icons, no emoji */}
      <div className="mb-8 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-soft p-1.5">
        <Link
          href="/jobs"
          className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
            !isRequest
              ? "bg-surface text-accent shadow-sm"
              : "text-ink-muted hover:text-ink-soft"
          }`}
        >
          <OfferIcon className="h-4 w-4" />
          <span>Offering</span>
          <span className={`rounded-full px-1.5 text-xs ${!isRequest ? "bg-accent-tint" : "bg-soft"}`}>
            {offerCount}
          </span>
        </Link>
        <Link
          href="/jobs?tab=requests"
          className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
            isRequest
              ? "bg-surface text-accent shadow-sm"
              : "text-ink-muted hover:text-ink-soft"
          }`}
        >
          <RequestIcon className="h-4 w-4" />
          <span>Looking</span>
          <span className={`rounded-full px-1.5 text-xs ${isRequest ? "bg-accent-tint" : "bg-soft"}`}>
            {requestCount}
          </span>
        </Link>
      </div>

      <form className="mb-8 flex gap-2" action="/jobs" method="GET">
        <input type="hidden" name="tab" value={isRequest ? "requests" : ""} />
        <input name="q" defaultValue={q || ""} placeholder="Search by skill, tag, or keyword…" className="input" />
        <button type="submit" className="btn-outline shrink-0">
          Search
        </button>
      </form>

      {posts.length === 0 ? (
        <EmptyState
          title={q ? "No matches found" : "Nothing posted yet"}
          description={
            q
              ? "Try a different search term."
              : isRequest
              ? "No one is looking for help right now. Be the first."
              : "No one is offering work right now. Be the first."
          }
          action={
            !q && (
              <Link href="/new" className="btn-primary">
                {isRequest ? "Post a request" : "Offer your skills"}
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-5 fade-in">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} viewerId={meId} />
          ))}
        </div>
      )}
    </div>
  );
}


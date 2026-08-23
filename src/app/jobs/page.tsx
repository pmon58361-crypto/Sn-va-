import Link from "next/link";
import { getPosts } from "@/lib/queries";
import { PostCard, EmptyState } from "@/components/posts/PostCard";
import { SectionHeader } from "@/components/posts/SectionHeader";
import { FilterBar, type FilterGroup } from "@/components/posts/FilterBar";
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
  searchParams: Promise<{
    tab?: string;
    q?: string;
    type?: string;
    loc?: string;
    budget?: string;
    status?: string;
  }>;
}) {
  const { tab, q, type, loc, budget, status } = await searchParams;
  const isRequest = tab === "requests";
  const category = isRequest ? "JOB_REQUEST" : "JOB_OFFER";

  const session = await auth();
  const meId = session?.user?.id;

  // Tab badges are plain counts — fetching two full ranked feeds just to
  // read .length used to cost ~8 extra DB round trips here.
  const [posts, offerCount, requestCount, typeRows, locationRows] =
    await Promise.all([
      getPosts({
        category,
        search: q,
        viewerId: meId,
        types: type ? [type] : undefined,
        location: loc || undefined,
        hasBudget: budget === "1" || undefined,
        includeClosed: status === "all",
      }),
      // Badges mirror the visible list (open, not hidden) so they never
      // advertise more inventory than the feed actually shows.
      prisma.post.count({ where: { category: "JOB_OFFER", hidden: false, status: "open" } }),
      prisma.post.count({ where: { category: "JOB_REQUEST", hidden: false, status: "open" } }),
      prisma.post.findMany({
        where: { category, type: { not: null } },
        select: { type: true },
        distinct: ["type"],
      }),
      prisma.post.findMany({
        where: { category, location: { not: null } },
        select: { location: true },
        distinct: ["location"],
      }),
    ]);

  const current = {
    tab: isRequest ? "requests" : "",
    q,
    type,
    loc,
    budget,
    status,
  };

  const filterGroups: FilterGroup[] = [
    {
      param: "type",
      label: "kind",
      options: [
        { value: "", label: "any" },
        ...typeRows
          .map((r) => r.type)
          .filter((t): t is string => !!t)
          .map((t) => ({ value: t, label: t.toLowerCase() })),
      ],
    },
    {
      param: "loc",
      label: "where",
      options: [
        { value: "", label: "anywhere" },
        ...locationRows
          .map((r) => r.location)
          .filter((l): l is string => !!l)
          .map((l) => ({ value: l, label: l })),
      ],
    },
    {
      param: "budget",
      label: "budget",
      options: [
        { value: "", label: "any" },
        { value: "1", label: "paid only" },
      ],
    },
    {
      param: "status",
      label: "state",
      options: [
        { value: "", label: "open" },
        { value: "all", label: "incl. closed" },
      ],
    },
  ];

  const hasFilters = Boolean(type || loc || budget || status === "all");

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
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-soft p-1.5">
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

      <form className="mb-4 flex gap-2" action="/jobs" method="GET">
        <input type="hidden" name="tab" value={isRequest ? "requests" : ""} />
        <input name="q" defaultValue={q || ""} placeholder="Search by skill, tag, or keyword…" className="input" />
        <button type="submit" className="btn-outline shrink-0">
          Search
        </button>
      </form>

      <FilterBar base="/jobs" current={current} groups={filterGroups} />

      {posts.length === 0 ? (
        <EmptyState
          title={
            q || hasFilters
              ? "Nothing matches these filters"
              : "Nothing posted yet"
          }
          description={
            q || hasFilters
              ? "Loosen a chip or try a different search term."
              : isRequest
              ? "No one is looking for help right now. Be the first."
              : "No one is offering work right now. Be the first."
          }
          action={
            !q && !hasFilters && (
              <Link href="/new" className="btn-primary">
                {isRequest ? "Post a request" : "Offer your skills"}
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-5 fade-in">
          <p className="font-mono text-xs text-white/35">
            {posts.length} result{posts.length === 1 ? "" : "s"}
            {(type || loc || budget) &&
              ` · filtered${type ? ` · ${type}` : ""}${loc ? ` · ${loc}` : ""}${budget === "1" ? " · paid" : ""}`}
          </p>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} viewerId={meId} showFeedback />
          ))}
        </div>
      )}
    </div>
  );
}

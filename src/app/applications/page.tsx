import { getPosts } from "@/lib/queries";
import { PostCard, EmptyState } from "@/components/posts/PostCard";
import { SectionHeader } from "@/components/posts/SectionHeader";
import { FilterBar, type FilterGroup } from "@/components/posts/FilterBar";
import { auth } from "@/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Job Applications — Snívať" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    loc?: string;
    budget?: string;
    status?: string;
  }>;
}) {
  const { q, type, loc, budget, status } = await searchParams;

  const [posts, session, typeRows, locationRows] = await Promise.all([
    getPosts({
      category: "JOB_LISTING",
      search: q,
      viewerId: (await auth())?.user?.id,
      types: type ? [type] : undefined,
      location: loc || undefined,
      hasBudget: budget === "1" || undefined,
      includeClosed: status === "all",
    }),
    auth(),
    prisma.post.findMany({
      where: { category: "JOB_LISTING", type: { not: null } },
      select: { type: true },
      distinct: ["type"],
    }),
    prisma.post.findMany({
      where: { category: "JOB_LISTING", location: { not: null } },
      select: { location: true },
      distinct: ["location"],
    }),
  ]);

  const current = { q, type, loc, budget, status };

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
        { value: "all", label: "incl. filled" },
      ],
    },
  ];

  const hasFilters = Boolean(type || loc || budget || status === "all");

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <SectionHeader
        eyebrow="Applications"
        title="Take the next step."
        description="Open positions, applied to in one breath. The friction between you and what's next — removed."
        href="/new"
      />

      <form className="mb-4 flex gap-2" action="/applications" method="GET">
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

      <FilterBar base="/applications" current={current} groups={filterGroups} />

      {posts.length === 0 ? (
        <EmptyState
          title={
            q || hasFilters
              ? "No jobs match these filters"
              : "No open positions yet"
          }
          description={
            q || hasFilters
              ? "Loosen a chip or try a different keyword."
              : "When employers post jobs, they'll show up here."
          }
          action={
            !q && !hasFilters && (
              <Link href="/new" className="btn-primary">
                Post a job
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4 fade-in">
          <p className="font-mono text-xs text-white/35">
            {posts.length} result{posts.length === 1 ? "" : "s"}
            {(type || loc || budget) &&
              ` · filtered${type ? ` · ${type}` : ""}${loc ? ` · ${loc}` : ""}${budget === "1" ? " · paid" : ""}`}
          </p>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} viewerId={session?.user?.id} showFeedback />
          ))}
        </div>
      )}
    </div>
  );
}

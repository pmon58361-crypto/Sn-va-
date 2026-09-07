import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTopTags } from "@/lib/queries";
import { cdnUrl } from "@/lib/cdn";
import { CATEGORY_META } from "@/lib/types";
import { HeartIcon } from "@/components/ui/Icons";

export const metadata = {
  title: "Explore",
  description: "Photos and trending topics from across Snívať.",
};
export const dynamic = "force-dynamic";

// Instagram Explore clone: masonry of real community photos + trending
// tag chips. Images only (text posts live in the feed); every tile links
// to its real detail page. Empty DB renders an honest empty state.
export default async function ExplorePage() {
  const [photos, topTags] = await Promise.all([
    prisma.post.findMany({
      where: {
        hidden: false,
        images: { some: {} },
        author: { is: { deactivatedAt: null } },
        NOT: [{ group: { visibility: "private" } }],
      },
      orderBy: { createdAt: "desc" },
      take: 36,
      select: {
        id: true,
        title: true,
        category: true,
        images: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
        author: { select: { id: true, name: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    getTopTags(12),
  ]);

  const hrefOf = (p: { id: string; category: string }) => {
    const meta = CATEGORY_META[p.category as keyof typeof CATEGORY_META];
    return `/${meta?.section || "community"}/${p.id}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Explore</h1>
      <p className="mb-5 mt-1 text-sm text-ink-muted">
        Photos and what people are talking about — all real, all now.
      </p>

      {topTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {topTags.map(([tag]) => (
            <Link
              key={tag}
              href={`/community?q=${encodeURIComponent(tag)}`}
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-14 text-center">
          <p className="text-lg font-semibold">No photos yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Be the first — post a photo and it lands here.
          </p>
          <Link href="/new" className="btn-primary mt-4 inline-block px-5 py-2 text-sm">
            New post
          </Link>
        </div>
      ) : (
        <div className="columns-2 gap-2 sm:columns-3 [&>*]:mb-2">
          {photos.map((p) => (
            <Link
              key={p.id}
              href={hrefOf(p)}
              className="group relative block break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cdnUrl(p.images[0].url, 640)}
                alt={p.title}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span className="flex items-center gap-1.5">
                  <HeartIcon className="h-5 w-5" />
                  {p._count.reactions}
                </span>
                <span className="flex items-center gap-1.5">
                  💬 {p._count.comments}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

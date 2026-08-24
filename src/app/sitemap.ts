import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type PostCategory } from "@/lib/types";

// Dynamic sitemap: static sections + open public posts + public profiles.
// Private/hidden content is never listed. Cached for an hour.
export const revalidate = 3600;

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://snivat.vercel.app";

// Posts live in different sections — /community/[id], /jobs/[id],
// /applications/[id] — mirroring detailPath in PostCard.
function postPath(category: string, id: string) {
  const section = CATEGORY_META[category as PostCategory]?.section || "community";
  return `/${section}/${id}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "", // landing
    "/community",
    "/people",
    "/jobs",
    "/auth/signin",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/community" ? "hourly" : "weekly",
    priority: path === "" ? 1 : path === "/community" ? 0.9 : 0.6,
  }));

  try {
    const [posts, users] = await Promise.all([
      prisma.post.findMany({
        where: { status: "open", hidden: false },
        select: { id: true, category: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.user.findMany({
        where: {
          deactivatedAt: null,
          OR: [{ settings: { publicProfile: true } }, { settings: null }],
        },
        select: { id: true },
        take: 500,
      }),
    ]);

    const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
      url: `${BASE}${postPath(p.category, p.id)}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    const profileUrls: MetadataRoute.Sitemap = users.map((u) => ({
      url: `${BASE}/profile/${u.id}`,
      changeFrequency: "daily",
      priority: 0.5,
    }));

    return [...staticRoutes, ...postUrls, ...profileUrls];
  } catch {
    // DB asleep/unreachable — ship the static skeleton rather than a 500.
    return staticRoutes;
  }
}

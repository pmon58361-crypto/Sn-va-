import type { Metadata } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://snivat.vercel.app";

/** Make any stored asset URL absolute (Cloudinary is already absolute). */
export function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** OG metadata for a post detail page. Hidden posts get nothing. */
export function buildPostMetadata(post: {
  title?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  hidden?: boolean | null;
}): Metadata {
  if (post.hidden) return {};

  const description =
    (post.content ?? "").replace(/\s+/g, " ").trim().slice(0, 160) ||
    "Shared on Snívať";

  const image = absoluteUrl(post.imageUrl);

  return {
    title: `${post.title} — Snívať`,
    description,
    openGraph: {
      title: post.title ?? undefined,
      description,
      images: image ? [{ url: image }] : undefined,
      type: "article",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.title ?? undefined,
      description,
      images: image ? [image] : undefined,
    },
  };
}

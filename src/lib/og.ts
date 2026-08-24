import type { Metadata } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://snivat.vercel.app";

/** Make any stored asset URL absolute (Cloudinary is already absolute).
    Legacy relative /uploads/* URLs from V1 dangle — they fall back to the
    branded card instead of an unfurl-breaking 404. */
export function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/uploads/")) return `${BASE}/og-image.png`;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

const FALLBACK_IMAGE = { url: "/og-image.png", width: 1200, height: 630 };

/** OG metadata for a post detail page. Hidden posts get nothing.
    `path` is the page route (e.g. "/community/abc123") so each post
    canonicalizes to itself instead of the homepage. */
export function buildPostMetadata(
  post: {
    title?: string | null;
    content?: string | null;
    imageUrl?: string | null;
    hidden?: boolean | null;
  },
  path?: string
): Metadata {
  if (post.hidden) return {};

  const description =
    (post.content ?? "").replace(/\s+/g, " ").trim().slice(0, 160) ||
    "Shared on Snívať";

  const image = absoluteUrl(post.imageUrl);
  const images = image ? [{ url: image }] : [FALLBACK_IMAGE];

  return {
    // Root layout appends "· Snívať" via the title template — don't repeat it here.
    title: post.title ?? undefined,
    description,
    alternates: { canonical: `${BASE}${path ?? ""}` },
    openGraph: {
      title: post.title ?? undefined,
      description,
      siteName: "Snívať",
      images,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title ?? undefined,
      description,
      images: images.map((i) => i.url),
    },
  };
}

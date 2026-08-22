import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://snivat.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/settings",
        "/dm",
        "/notifications",
        "/bookmarks",
        "/new",
        "/archive",
        "/api/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}

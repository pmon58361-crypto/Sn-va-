import { NextRequest, NextResponse } from "next/server";
import { extractVideoEmbed } from "@/lib/embeds";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Server-side X preview: fetches the tweet's public oEmbed (author +
// words) so cards render the actual post inline — no X JavaScript, no
// iframe, nothing for tracker blockers to kill. Tap still goes to X for
// the full thread; reading stays home.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || "";
  const embed = extractVideoEmbed(raw);
  if (!embed || embed.platform !== "x") {
    return NextResponse.json({ error: "Not an X post URL" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(embed.srcUrl)}&omit_script=1`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Unavailable" }, { status: 502 });
    }
    const data = (await res.json()) as {
      author_name?: string;
      author_url?: string;
      html?: string;
    };
    // oEmbed html is a blockquote with <p> text + links — reduce to plain
    // readable text (entities decoded, tags stripped, links dropped).
    const text = (data.html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, "—")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      // oEmbed appends an attribution tail ("— Author (@handle) Date") —
      // the card already shows the author, so cut it.
      .replace(/\n?— [^\n]*\(@[^)]*\) [A-Z][a-z]+ \d{1,2}, \d{4}$/, "")
      .trim()
      .slice(0, 560);
    if (!text) {
      return NextResponse.json({ error: "Unavailable" }, { status: 502 });
    }
    // Lazy search-index write: persist the words onto the post (first
    // fetch wins, only when empty) so search reaches phrases that live
    // behind the link. Fire-and-forget — preview must never wait on it.
    const postId = req.nextUrl.searchParams.get("postId");
    if (postId) {
      prisma.post
        .updateMany({
          where: { id: postId, linkPreviewText: null },
          data: {
            linkPreviewAuthor: (data.author_name || "Post on X").slice(0, 120),
            linkPreviewText: text,
          },
        })
        .catch(() => {});
    }
    return NextResponse.json({
      author: data.author_name || "Post on X",
      authorUrl: data.author_url || embed.srcUrl,
      text,
      url: embed.srcUrl,
    });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}

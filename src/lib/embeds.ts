/**
 * Video link embed detection — pure functions, zero deps, no storage.
 * A pasted YouTube / TikTok / Instagram URL inside post content is detected
 * at render time; nothing is ever downloaded or hosted (that's the point).
 */

export type VideoEmbed = {
  platform: "youtube" | "tiktok" | "instagram";
  id: string;
  /** The matched URL, trailing punctuation stripped — used for cite/fallback. */
  srcUrl: string;
};

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export function extractVideoEmbed(content: string): VideoEmbed | null {
  if (!content) return null;
  const urls = content.match(URL_RE);
  if (!urls) return null;

  for (const raw of urls) {
    const srcUrl = raw.replace(/[.,;:!?)\]]+$/, "");
    let url: URL;
    try {
      url = new URL(srcUrl);
    } catch {
      continue;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    // YouTube — watch?v=, youtu.be, shorts, live, embed
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      let id = "";
      if (host === "youtu.be") {
        id = url.pathname.slice(1);
      } else if (url.pathname === "/watch") {
        id = url.searchParams.get("v") ?? "";
      } else {
        const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]+)/);
        if (m) id = m[1];
      }
      id = id.split("/")[0];
      if (/^[A-Za-z0-9_-]{6,20}$/.test(id)) return { platform: "youtube", id, srcUrl };
      continue;
    }

    // TikTok — full /@user/video/<id> URLs only; short vm.tiktok.com links
    // stay plain text (no reliable id to embed from).
    if (host === "tiktok.com") {
      const m = url.pathname.match(/^\/@[\w.\-]+\/video\/(\d{6,25})/);
      if (m) return { platform: "tiktok", id: m[1], srcUrl };
      continue;
    }

    // Instagram — reels and posts
    if (host === "instagram.com") {
      const m = url.pathname.match(/^\/(?:reels?|p)\/([A-Za-z0-9_-]{5,25})/);
      if (m) return { platform: "instagram", id: m[1], srcUrl };
      continue;
    }
  }
  return null;
}

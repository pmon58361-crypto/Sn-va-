/**
 * Video link embed detection — pure functions, zero deps, no storage.
 * A pasted YouTube / TikTok / Instagram / X URL inside post content is detected
 * at render time; nothing is ever downloaded or hosted (that's the point).
 */

export type VideoEmbed = {
  platform: "youtube" | "tiktok" | "instagram" | "x";
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

    // X (Twitter) — x.com/<user>/status/<id> or twitter.com/<user>/status/<id>
    if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") {
      const m = url.pathname.match(/^\/[^/]+\/status\/(\d{6,25})/);
      if (m) return { platform: "x", id: m[1], srcUrl };
      continue;
    }
  }
  return null;
}

/**
 * Strip the embedded video URL from displayed text. The player below
 * already represents the link — showing the raw URL line above it is
 * visual noise (FB/IG never render the bare link). Only the FIRST matched
 * embed URL is removed; any other links (sources, references) stay.
 */
export function stripEmbedUrl(content: string): string {
  if (!content) return content;
  const embed = extractVideoEmbed(content);
  const fb = !embed ? extractFacebookLink(content) : null;
  const srcUrl = embed?.srcUrl ?? fb?.srcUrl;
  if (!srcUrl) return content;
  const idx = content.indexOf(srcUrl);
  if (idx === -1) return content;
  const stripped = (content.slice(0, idx) + content.slice(idx + srcUrl.length))
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  return stripped;
}

/**
 * Facebook link detection — card-only, deliberately NOT a player.
 * Facebook's embed iframe is tracker-laden (same death as X's was), and
 * Facebook offers no public preview API (oEmbed needs an app token), so
 * there are no words to fetch. The card keeps the feed clean; the tap
 * goes to Facebook. Handles posts, reels, watch, and /share/ links.
 */
export function extractFacebookLink(content: string): { srcUrl: string } | null {
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
    const host = url.hostname.replace(/^www\.|^m\.|^web\./, "").toLowerCase();
    if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") {
      return { srcUrl };
    }
  }
  return null;
}

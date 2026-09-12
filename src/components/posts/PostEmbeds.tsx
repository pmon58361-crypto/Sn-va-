"use client";

import { useEffect, useRef, useState } from "react";
import { extractVideoEmbed } from "@/lib/embeds";

/**
 * PostEmbeds — renders ONE embed for the first recognized video link in
 * post content. YouTube gets a thumbnail facade (~30KB, zero iframe
 * weight): tap opens the YouTube watch page in a new tab — the goal is
 * sending humans to the channel (discovery there, depth here), not
 * farming embed renders. Instagram/X/TikTok keep their lazy iframes.
 *
 * House rules honored: never auto-play (no autoplay params anywhere), the
 * TikTok embed script is injected ONLY when the embed scrolls near the
 * viewport, iframes use native lazy loading, and every embedded URL is
 * constructed from a validated ID — never raw user URLs. X renders through
 * Tweet.html with dnt=1 (no widgets.js tracking script) in the app's theme.
 * The TikTok/X fallback markup contains no anchors, so this component is
 * safe to render anywhere — nested <a> tags cause hydration errors.
 */

export function PostEmbeds({ content }: { content: string }) {
  const embed = extractVideoEmbed(content);
  const bqRef = useRef<HTMLQuoteElement | null>(null);
  // X iframe theme follows the app theme (light class = light, else dark).
  const [xTheme] = useState(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("light")
      ? "light"
      : "dark"
  );

  // TikTok needs their embed.js to turn the blockquote into an iframe.
  // Load it on demand: only once, only when this embed approaches the viewport.
  useEffect(() => {
    if (embed?.platform !== "tiktok") return;
    const bq = bqRef.current;
    if (!bq) return;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const w = window as unknown as {
        tiktok?: { embed?: { lib?: { render?: (el: HTMLElement) => void } } };
      };
      w.tiktok?.embed?.lib?.render?.(bq);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        io.disconnect();
        const src = "https://www.tiktok.com/embed.js";
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${src}"]`
        );
        if (!existing) {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.addEventListener("load", render, { once: true });
          document.head.appendChild(s);
        } else {
          // Script tag present: if still loading, render on load; if already
          // loaded, render immediately (lib.render is idempotent per element).
          existing.addEventListener("load", render, { once: true });
          render();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(bq);

    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  if (!embed) return null;

  if (embed.platform === "youtube") {
    return (
      <a
        href={`https://www.youtube.com/watch?v=${embed.id}`}
        target="_blank"
        rel="nofollow noopener"
        className="group relative mt-3 block overflow-hidden rounded-xl border border-line bg-black"
        style={{ aspectRatio: "16 / 9" }}
        aria-label="Watch on YouTube (opens in a new tab)"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg`}
          alt="YouTube video thumbnail"
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/10">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-black/65 text-2xl text-white transition group-hover:scale-110 group-hover:bg-accent">
            <span aria-hidden className="ml-1">▶</span>
          </span>
        </span>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
          YouTube ↗
        </span>
      </a>
    );
  }

  if (embed.platform === "instagram") {
    return (
      <div
        className="mx-auto mt-3 w-full overflow-hidden rounded-xl border border-line bg-surface"
        style={{ aspectRatio: "4 / 5", maxWidth: 480 }}
      >
        <iframe
          src={`https://www.instagram.com/p/${embed.id}/embed`}
          title="Instagram video"
          loading="lazy"
          className="h-full w-full"
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (embed.platform === "x") {
    return (
      <div
        className="mx-auto mt-3 w-full overflow-hidden rounded-xl border border-line bg-surface"
        style={{ maxWidth: 550 }}
      >
        <iframe
          src={`https://platform.twitter.com/embed/Tweet.html?id=${embed.id}&dnt=true&theme=${xTheme}`}
          title="X post"
          loading="lazy"
          className="h-[420px] w-full"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-3 w-full" style={{ maxWidth: 480, minHeight: 240 }}>
      <blockquote
        ref={bqRef}
        className="tiktok-embed"
        cite={embed.srcUrl}
        data-video-id={embed.id}
        style={{ margin: 0 }}
      >
        <a href={embed.srcUrl} rel="nofollow noopener" target="_blank">
          Watch on TikTok
        </a>
      </blockquote>
    </div>
  );
}

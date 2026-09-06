"use client";

import { useEffect, useRef, useState } from "react";
import { extractVideoEmbed } from "@/lib/embeds";

/**
 * PostEmbeds — renders ONE embedded player for the first recognized video
 * link in post content (YouTube nocookie iframe, Instagram embed iframe,
 * X Tweet iframe, or TikTok blockquote + their script).
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
      <div
        className="mt-3 overflow-hidden rounded-xl border border-line bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${embed.id}?rel=0`}
          title="YouTube video"
          loading="lazy"
          className="h-full w-full"
          allow="fullscreen; picture-in-picture; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
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

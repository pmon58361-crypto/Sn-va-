"use client";

import { useEffect, useRef, useState } from "react";
import { extractVideoEmbed } from "@/lib/embeds";

/**
 * PostEmbeds — renders ONE embed for the first recognized video link in
 * post content. YouTube gets a thumbnail facade (~30KB, zero iframe
 * weight): tap plays INLINE on Snívať (nocookie embed, autoplay on tap
 * only) with a small YouTube ↗ side door to the channel. Watching stays
 * home; discovery still flows outward. Instagram keeps its lazy iframe;
 * X renders a link card enhanced by widgets.js when it loads; TikTok
 * keeps blockquote + script.
 *
 * House rules honored: never auto-play (no autoplay params anywhere), the
 * TikTok/X embed scripts are injected ONLY when the embed scrolls near
 * the viewport, iframes use native lazy loading, and every embedded URL
 * is constructed from a validated ID — never raw user URLs.
 * The TikTok fallback markup contains no anchors, so this component is
 * safe to render anywhere — nested <a> tags cause hydration errors.
 */

export function PostEmbeds({ content }: { content: string }) {
  const embed = extractVideoEmbed(content);
  const bqRef = useRef<HTMLQuoteElement | null>(null);
  // YouTube facade state: thumbnail until tap, inline player after.
  const [playingId, setPlayingId] = useState<string | null>(null);

  // X embeds render through widgets.js onto a plain blockquote (the
  // official path) — NOT the Tweet.html iframe. Reason: the iframe shell
  // loads but its inner fetch dies under third-party-cookie blocking or
  // tracker blockers, leaving a dead white box (observed live). The
  // blockquote is a clean link card on its own; widgets.js only enhances
  // it when it loads. Same lazy-on-approach pattern as TikTok.
  useEffect(() => {
    if (embed?.platform !== "x") return;
    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        io.disconnect();
        const src = "https://platform.x.com/widgets.js";
        if (!document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)) {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.charset = "utf-8";
          document.head.appendChild(s);
        } else {
          const w = window as unknown as {
            twttr?: { widgets?: { load?: () => void } };
          };
          w.twttr?.widgets?.load?.();
        }
      },
      { rootMargin: "200px" }
    );
    // Observe the embed container when it mounts.
    const el = document.querySelector("[data-x-embed]");
    if (el) io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [embed?.platform, embed?.id]);
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
    if (playingId === embed.id) {
      return (
        <div className="relative mt-3">
          <div
            className="overflow-hidden rounded-xl border border-line bg-black"
            style={{ aspectRatio: "16 / 9" }}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${embed.id}?rel=0&autoplay=1`}
              title="YouTube video"
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${embed.id}`}
            target="_blank"
            rel="nofollow noopener"
            className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-black/85"
          >
            YouTube ↗
          </a>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setPlayingId(embed.id)}
        className="group relative mt-3 block w-full overflow-hidden rounded-xl border border-line bg-black"
        style={{ aspectRatio: "16 / 9" }}
        aria-label="Play video on Snívať"
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
          ▶ Watch here
        </span>
      </button>
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
      <div data-x-embed className="mx-auto mt-3 w-full" style={{ maxWidth: 550 }}>
        <blockquote className="twitter-tweet" data-dnt="true" style={{ margin: 0 }}>
          <a
            href={embed.srcUrl}
            rel="nofollow noopener"
            target="_blank"
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent"
          >
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg font-black text-bg">
              𝕏
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold text-ink">
                View post on X
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {embed.srcUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-ink-faint">↗</span>
          </a>
        </blockquote>
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

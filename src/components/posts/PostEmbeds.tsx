"use client";

import { useEffect, useRef, useState } from "react";
import { extractVideoEmbed, extractFacebookLink } from "@/lib/embeds";

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

export function PostEmbeds({ content, postId }: { content: string; postId?: string }) {
  const embed = extractVideoEmbed(content);
  // Facebook has no player and no preview API — a clean outbound card so
  // FB links never render as bare URLs. Checked only when no video embed
  // matched (one embed per post, first signal wins).
  const fb = !embed ? extractFacebookLink(content) : null;
  const bqRef = useRef<HTMLQuoteElement | null>(null);
  // YouTube facade state: thumbnail until tap, inline player after.
  const [playingId, setPlayingId] = useState<string | null>(null);

  // X embeds NEVER use X JavaScript (Tweet.html iframe or widgets.js):
  // both phone home with trackers, so tracker blockers (Edge's is on by
  // default) kill them into dead white boxes (observed live). Instead the
  // XCard below renders the tweet's real words via our own server preview
  // route — readable inline, nothing to block, tap goes to X for replies.
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

  if (!embed) {
    if (!fb) return null;
    return (
      <a
        href={fb.srcUrl}
        rel="nofollow noopener"
        target="_blank"
        className="mx-auto mt-3 flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent"
        style={{ maxWidth: 550 }}
      >
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1877f2] text-lg font-black text-white"
        >
          f
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-ink">
            View post on Facebook
          </span>
          <span className="block truncate text-xs text-ink-muted">
            {fb.srcUrl.replace(/^https?:\/\/(www\.|m\.|web\.)?/, "")}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-faint">
          ↗
        </span>
      </a>
    );
  }

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
    return <XCard srcUrl={embed.srcUrl} postId={postId} />;
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

type XPreview = { author: string; authorUrl: string; text: string; url: string };

// X card with server-fetched words: tap opens an in-app mini page with
// the full text (reading stays home); the X thread link is a secondary
// action inside. A failed preview degrades to the plain link card —
// never a blank hole.
function XCard({ srcUrl, postId }: { srcUrl: string; postId?: string }) {
  const [preview, setPreview] = useState<XPreview | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        io.disconnect();
        const params = new URLSearchParams({ url: srcUrl });
        // Tells the preview route which post to file the words under
        // (lazy search-index write, first fetch wins).
        if (postId) params.set("postId", postId);
        fetch(`/api/embeds/oembed?${params.toString()}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!cancelled && d && d.text) setPreview(d as XPreview);
          })
          .catch(() => {});
      },
      { rootMargin: "200px" }
    );
    const el = document.querySelector(`[data-x-src="${CSS.escape(srcUrl)}"]`);
    if (el) io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [srcUrl, postId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-x-src={srcUrl}
        className="mx-auto mt-3 block w-full text-left"
        style={{ maxWidth: 550 }}
        aria-label={preview ? "Read post" : "View post on X"}
      >
        <span className="block rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent">
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg font-black text-bg"
            >
              𝕏
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {preview ? preview.author : "Post on X"}
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {srcUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-ink-faint">
              ↗
            </span>
          </span>
          {preview && (
            <span className="mt-2.5 line-clamp-4 block whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
              {preview.text}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Post preview"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg font-black text-bg"
              >
                𝕏
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {preview ? preview.author : "Post on X"}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close preview"
                className="grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-full text-lg text-ink-muted transition hover:bg-surface-hover hover:text-ink"
              >
                ×
              </button>
            </div>
            {preview ? (
              <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
                {preview.text}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                Preview didn&apos;t load — the full post is on X.
              </p>
            )}
            <a
              href={srcUrl}
              rel="nofollow noopener"
              target="_blank"
              className="btn-outline mt-4 block w-full py-2.5 text-center text-sm"
            >
              Open thread on X ↗
            </a>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export type AdData = {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
};

// First-party sponsored card. Unmissable on purpose: gold ring + tint wash
// + solid CTA so paid placement never masquerades as a community post —
// the persistent "Sponsored" label is the honesty half of the same deal.
// No tracking of any kind — the click goes through our own redirect route
// which counts it. If the image fails to load we hide the node and keep
// headline+advertiser, so the card degrades gracefully instead of showing
// a broken-image icon.
//
// Viewability: once the card holds the viewport for a full second we fire a
// single beacon at the view route. Attention, not delivery, and unbilled.
export function AdCard({
  ad,
  variant = "feed",
  viewerId,
}: {
  ad: AdData;
  variant?: "feed" | "sidebar";
  viewerId?: string | null;
}) {
  const [imgOk, setImgOk] = useState(true);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const sidebar = variant === "sidebar";

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const send = () => {
      if (done) return;
      done = true;
      fetch(`/api/ads/${ad.id}/view`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(viewerId ? { viewerId } : {}),
        keepalive: true,
      }).catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
        if (visible && !timer) {
          timer = setTimeout(() => {
            timer = null;
            send();
          }, 1000);
        } else if (!visible && timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    io.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [ad.id, viewerId]);

  return (
    <a
      ref={cardRef}
      href={`/api/ads/${ad.id}/click`}
      target="_blank"
      rel="nofollow sponsored noopener"
      aria-label={`Sponsored: ${ad.headline}`}
      className={`group block overflow-hidden rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-tint)] ${
        sidebar ? "p-4" : "sm:card"
      }`}
    >
      <div className={`flex items-center gap-2 ${sidebar ? "mb-2" : "px-4 pt-3 sm:px-5"}`}>
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 11 18-5v12L3 14v-3z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
          </svg>
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
          Sponsored
        </span>
        <span className="ml-auto truncate text-[11px] font-medium text-ink-muted">
          {ad.advertiser}
        </span>
      </div>

      {ad.imageUrl && imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt=""
          onError={() => setImgOk(false)}
          className={`w-full object-cover ${sidebar ? "mt-1 rounded-xl border border-line" : "mt-2.5 border-y border-line"}`}
        />
      )}

      <p
        className={`font-extrabold leading-tight tracking-tight text-ink ${
          sidebar ? "mt-2.5 text-[15px]" : "px-4 pt-3 text-lg sm:px-5 sm:text-xl"
        }`}
      >
        {ad.headline}
      </p>

      <div className={`${sidebar ? "mt-2.5" : "mt-3 px-4 pb-4 sm:px-5"}`}>
        <span
          aria-hidden
          className={`inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] font-bold text-[var(--accent-ink)] transition group-hover:bg-[var(--accent-hover)] ${
            sidebar ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
          }`}
        >
          Visit
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </span>
      </div>
    </a>
  );
}

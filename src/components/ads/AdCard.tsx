"use client";

import { useState } from "react";

export type AdData = {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
};

// First-party sponsored card. Persistent "Sponsored" label, no tracking of
// any kind — the click goes through our own redirect route which counts it.
// If the image fails to load we hide the node and keep headline+advertiser,
// so the card degrades gracefully instead of showing a broken-image icon.
export function AdCard({
  ad,
  variant = "feed",
}: {
  ad: AdData;
  variant?: "feed" | "sidebar";
}) {
  const [imgOk, setImgOk] = useState(true);
  const sidebar = variant === "sidebar";

  return (
    <a
      href={`/api/ads/${ad.id}/click`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className={`group block overflow-hidden rounded-2xl bg-surface sm:card sm:card-hover ${
        sidebar ? "p-4" : ""
      }`}
    >
      <div className={`flex items-center justify-between ${sidebar ? "mb-2" : "px-4 pt-2.5 sm:px-5"}`}>
        <span className="badge bg-accent-tint text-[10px] uppercase tracking-wide text-accent">
          Sponsored
        </span>
        <span className="text-[11px] text-ink-faint">{ad.advertiser}</span>
      </div>

      {ad.imageUrl && imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt=""
          onError={() => setImgOk(false)}
          className={`w-full object-cover ${sidebar ? "mt-1 rounded-lg" : "mt-2"}`}
        />
      )}

      <p
        className={`font-semibold leading-snug text-ink transition-colors group-hover:text-accent ${
          sidebar ? "mt-2 text-sm" : "px-4 pt-2 text-base sm:px-5"
        }`}
      >
        {ad.headline}
      </p>

      {!sidebar && (
        <div className="mt-2.5 px-4 pb-3 sm:px-5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            Learn more
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </div>
      )}
    </a>
  );
}

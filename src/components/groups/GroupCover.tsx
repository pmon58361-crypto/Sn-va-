"use client";

import { useState } from "react";

/**
 * Group cover with a graceful fallback. A dead coverUrl (deleted CDN asset,
 * expired upload) renders nothing by default — a white void that looks
 * broken. On error we swap to the gradient-letter tile instead.
 */
export function GroupCover({ name, coverUrl }: { name: string; coverUrl: string | null }) {
  const [dead, setDead] = useState(false);
  if (!coverUrl || dead) {
    return (
      <div className="grid h-24 w-full place-items-center bg-gradient-to-tr from-accent/25 to-like/20 text-2xl font-black text-ink">
        {(name || "?").trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt=""
      loading="lazy"
      onError={() => setDead(true)}
      className="h-24 w-full object-cover"
    />
  );
}

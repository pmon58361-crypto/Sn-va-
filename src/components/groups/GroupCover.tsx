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
      <div className="grid h-full min-h-24 w-full place-items-center bg-gradient-to-tr from-accent/25 to-like/20 text-3xl font-black text-ink">
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
      className="h-full min-h-24 w-full object-cover"
    />
  );
}

/**
 * Square group icon, customized independently from the banner cover.
 * Dead/missing avatarUrl falls back to the letter tile — never a broken
 * glyph. Pair with `tileClassName` sized by the caller (card tile, hero
 * avatar) since the image simply fills its box.
 */
export function GroupAvatar({
  name,
  avatarUrl,
  coverUrl,
  tileClassName,
}: {
  name: string;
  avatarUrl: string | null;
  /** Second fallback for card tiles: crop the banner before the letter. */
  coverUrl?: string | null;
  tileClassName: string;
}) {
  const [dead, setDead] = useState(false);
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  const src = !dead ? avatarUrl || coverUrl || null : null;
  if (!src) {
    return (
      <span className={`grid place-items-center overflow-hidden bg-accent font-black text-white ${tileClassName}`}>
        {letter}
      </span>
    );
  }
  return (
    <span className={`block overflow-hidden ${tileClassName}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setDead(true)}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

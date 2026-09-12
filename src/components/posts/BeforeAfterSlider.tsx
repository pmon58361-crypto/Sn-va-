"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cdnUrl } from "@/lib/cdn";

/**
 * The signature interaction: drag slider comparing before (RAW) vs after
 * (FINAL). Pointer Events only — no library — touch included.
 *
 * Graceful degradation: pre-hydration (and no-JS clients) render the
 * side-by-side labeled stack; the slider takes over on mount. Both images
 * share one box via object-fit: cover so mismatched dimensions still read
 * as a single comparison.
 */
export function BeforeAfterSlider({
  before,
  after,
  large,
}: {
  before: { url: string; alt: string | null };
  after: { url: string; alt: string | null };
  large?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Mount-gate: first paint is the static stack (SSR/no-JS safe).
  useEffect(() => {
    setMounted(true);
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  const boxClass = large ? "aspect-[4/3]" : "aspect-[16/10]";
  const width = large ? 1280 : 960;

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { ...before, tag: "RAW" },
            { ...after, tag: "FINAL" },
          ] as const
        ).map((img) => (
          <figure key={img.tag} className="relative overflow-hidden rounded-lg border border-line bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cdnUrl(img.url, 640)}
              alt={img.alt || img.tag}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <figcaption className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
              {img.tag}
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Before and after comparison slider"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
        if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      className={`relative w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-lg border border-line bg-soft ${boxClass}`}
    >
      {/* AFTER — full-bleed base layer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cdnUrl(after.url, width)}
        alt={after.alt || "Final result"}
        loading="lazy"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* BEFORE — clipped overlay, revealed left of the handle. */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cdnUrl(before.url, width)}
          alt={before.alt || "Raw original"}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {/* Badges */}
      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
        RAW
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
        FINAL
      </span>
      {/* Handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-bold text-ink shadow-lg">
          ↔
        </span>
      </div>
    </div>
  );
}

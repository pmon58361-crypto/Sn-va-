"use client";

import { useCallback, useEffect, useState } from "react";
import { cdnUrl } from "@/lib/cdn";

type GridImage = { id: string; url: string; order: number };
type GridPost = { category: string; id: string; title: string };

const GAP = "gap-[3px]";
const TILE = "relative overflow-hidden bg-soft";

function detailPath(category: string, id: string) {
  return `/${category === "COMMUNITY" ? "community" : "jobs"}/${id}`;
}

/**
 * Facebook-style multi-image grid with an in-feed lightbox.
 * 1 → full width natural ratio (no crop), 2 → split,
 * 3 → top + two, 4+ → 2x2 with +N overlay.
 * Click any tile → full-screen viewer (Esc / backdrop closes).
 */
export function ImageGrid({
  images,
  post,
}: {
  images: GridImage[];
  post: GridPost;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) =>
      setOpen((i) => (i === null ? null : (i + d + count) % count)),
    [count]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, step]);

  const openTile = (i: number) => (
    <button
      key={images[i].id}
      type="button"
      onClick={() => setOpen(i)}
      className={`${TILE} block w-full cursor-zoom-in text-left`}
      aria-label={`Open image ${i + 1} of ${count}`}
    >
      <GridImg src={images[i].url} alt={post.title} />
    </button>
  );

  let layout: React.ReactNode;

  if (count === 1) {
    layout = (
      <div className="bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cdnUrl(images[0].url, 1080)}
          alt={post.title}
          className="mx-auto max-h-[70vh] w-full cursor-zoom-in object-contain"
          onClick={() => setOpen(0)}
          loading="lazy"
        />
      </div>
    );
  } else if (count === 2) {
    layout = (
      <div className={`grid grid-cols-2 h-[min(440px,70vh)] ${GAP}`}>
        {[0, 1].map(openTile)}
      </div>
    );
  } else if (count === 3) {
    layout = (
      <div className={`flex flex-col ${GAP}`}>
        <div className="h-[min(260px,40vh)]">{openTile(0)}</div>
        <div className={`grid grid-cols-2 h-[min(180px,30vh)] ${GAP}`}>
          {[1, 2].map(openTile)}
        </div>
      </div>
    );
  } else {
    const shown = images.slice(0, 4);
    const extra = count - 4;
    layout = (
      <div className={`grid aspect-square grid-cols-2 ${GAP}`}>
        {shown.map((_, i) => {
          const isLast = i === 3 && extra > 0;
          return (
            <div key={images[i].id} className={TILE}>
              {openTile(i)}
              {isLast && (
                <div
                  className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55"
                  aria-hidden
                >
                  <span className="text-3xl font-bold text-white drop-shadow">
                    +{extra}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {layout}
      {open !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={post.title}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cdnUrl(images[open].url, 1400)}
            alt={post.title}
            className="max-h-[92vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {count > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/25"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/25"
                aria-label="Next image"
              >
                ›
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                {open + 1} / {count}
              </span>
            </>
          )}
          <a
            href={detailPath(post.category, post.id)}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            View post
          </a>
        </div>
      )}
    </>
  );
}

function GridImg({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cdnUrl(src, 720)}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  );
}

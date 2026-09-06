"use client";

import { useCallback, useEffect, useState } from "react";
import { cdnUrl } from "@/lib/cdn";
import { PhotoTheater } from "@/components/posts/PhotoTheater";

type GridImage = { id: string; url: string; order: number };
type GridPost = {
  category: string;
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null } | null;
};

export type GridActions = {
  likes: number;
  dislikes: number;
  comments: number;
  liked: boolean;
  disliked: boolean;
  bookmarked: boolean;
  signedIn: boolean;
  isOwner: boolean;
};

const GAP = "gap-[3px]";
const TILE = "relative overflow-hidden bg-soft";

/**
 * Facebook-style multi-image grid. Click any tile → theater view
 * (photo stage + post + live comments), which owns its own guards,
 * zoom, and keyboard handling.
 * 1 → full width natural ratio (no crop), 2 → split,
 * 3 → top + two, 4+ → 2x2 with +N overlay.
 */
export function ImageGrid({
  images,
  post,
  actions,
}: {
  images: GridImage[];
  post: GridPost;
  actions: GridActions;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => {
      setOpen((i) => (i === null ? null : (i + d + count) % count));
    },
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
      className={`${TILE} block w-full cursor-zoom-in touch-manipulation text-left select-none`}
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
          className="mx-auto max-h-[70vh] w-full cursor-zoom-in touch-manipulation select-none object-contain"
          onClick={() => setOpen(0)}
          loading="lazy"
          draggable={false}
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
      {open !== null && images[open] && (
        <PhotoTheater
          key={`${post.id}-${open}`}
          images={images}
          index={open}
          post={post}
          actions={actions}
          onClose={close}
          onStep={step}
        />
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
      draggable={false}
    />
  );
}

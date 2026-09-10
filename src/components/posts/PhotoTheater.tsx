"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ProfileHover } from "@/components/profile/ProfileHover";
import { PostActions } from "@/components/posts/PostActions";
import { CommentComposer } from "@/components/posts/CommentComposer";
import { ReportMenu } from "@/components/moderation/ReportMenu";
import { cdnUrl } from "@/lib/cdn";
import { timeAgo } from "@/lib/utils";

export type TheaterImage = { id: string; url: string; order: number };

export type TheaterPost = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  category: string;
  author: { id: string; name: string | null; image: string | null } | null;
};

export type TheaterActions = {
  likes: number;
  dislikes: number;
  comments: number;
  liked: boolean;
  disliked: boolean;
  bookmarked: boolean;
  signedIn: boolean;
  isOwner: boolean;
};

type TheaterComment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null } | null;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * PhotoTheater — Facebook-style photo viewer. Stage on the left (arrows,
 * counter, zoom controls, close), post + live comments on the right.
 * Desktop: side-by-side. Mobile: photo on top, panel scrolls below.
 *
 * Safety rules (kept from the old viewer): backdrop taps are ignored for
 * the first 250ms and until the full-size photo loads — stray taps can't
 * dismiss it mid-load. The × button always works.
 */
export function PhotoTheater({
  images,
  index,
  post,
  actions,
  onClose,
  onStep,
}: {
  images: TheaterImage[];
  index: number;
  post: TheaterPost;
  actions: TheaterActions;
  onClose: () => void;
  onStep: (d: number) => void;
}) {
  const count = images.length;
  const [zoom, setZoom] = useState(1);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [comments, setComments] = useState<TheaterComment[] | null>(null);
  const openedAt = useRef(Date.now());
  const loadedRef = useRef(false);

  // Fresh photo → reset zoom + loading state.
  useEffect(() => {
    setZoom(1);
    loadedRef.current = false;
    setFullLoaded(false);
  }, [index, images]);

  // Live comments for the side panel.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${post.id}/comments`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setComments(d.comments ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  // Lock background scroll while the theater is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const guardedBackdropClose = useCallback(() => {
    if (Date.now() - openedAt.current < 250) return;
    if (!loadedRef.current) return;
    onClose();
  }, [onClose]);

  const zoomBy = useCallback(
    (d: number) =>
      setZoom((z) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + d) * 10) / 10))
      ),
    []
  );

  const img = images[index];
  // Portal out of the feed card: .card-hover:hover applies a transform,
  // which would trap position:fixed inside the card (viewer mounts while
  // hovered, then snaps to fullscreen when the mouse moves — the zoom
  // flicker). In the body portal, fixed is always viewport-relative.
  if (!img || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 lg:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={post.title}
    >
      {/* ── Stage ── */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black p-2 sm:p-4"
        onClick={guardedBackdropClose}
      >
        {/* Top-left controls */}
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/25 touch-manipulation"
            aria-label="Close viewer"
          >
            ×
          </button>
          <Link
            href={`/${post.category === "COMMUNITY" ? "community" : "jobs"}/${post.id}`}
            onClick={(e) => e.stopPropagation()}
            className="grid h-11 place-items-center rounded-full bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/25 touch-manipulation"
          >
            View post
          </Link>
        </div>

        {/* Zoom controls */}
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              zoomBy(-0.5);
            }}
            disabled={zoom <= MIN_ZOOM}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/25 touch-manipulation disabled:opacity-30"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom(1);
            }}
            disabled={zoom === MIN_ZOOM}
            className="grid h-11 place-items-center rounded-full bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/25 touch-manipulation disabled:opacity-30"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              zoomBy(0.5);
            }}
            disabled={zoom >= MAX_ZOOM}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/25 touch-manipulation disabled:opacity-30"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        {/* Photo (instant cached size, full-res crossfades on top) */}
        <div
          className="relative flex max-h-full max-w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setZoom((z) => (z === MIN_ZOOM ? 2 : MIN_ZOOM));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cdnUrl(img.url, 720)}
            alt={post.title}
            aria-hidden={fullLoaded}
            className="max-h-[70vh] max-w-full touch-manipulation select-none object-contain lg:max-h-[92vh]"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={img.url}
            src={cdnUrl(img.url, 1400)}
            alt=""
            onLoad={() => {
              loadedRef.current = true;
              setFullLoaded(true);
            }}
            aria-hidden={!fullLoaded}
            className="absolute inset-0 h-full w-full touch-manipulation select-none object-contain transition-opacity duration-200"
            style={{ opacity: fullLoaded ? 1 : 0 }}
            draggable={false}
          />
          {!fullLoaded && (
            <span
              aria-hidden
              className="absolute bottom-3 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"
            />
          )}
        </div>

        {/* Arrows + counter */}
        {count > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStep(-1);
              }}
              className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/25 touch-manipulation"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStep(1);
              }}
              className="absolute right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/25 touch-manipulation"
              aria-label="Next image"
            >
              ›
            </button>
            <span className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {/* ── Side panel ── */}
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-white/10 bg-bg lg:max-h-none lg:h-full lg:w-[380px] lg:border-l lg:border-t-0">
        {/* Author */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          {post.author?.id ? (
            <ProfileHover userId={post.author.id}>
              <Link
                href={`/profile/${post.author.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar
                  name={post.author?.name}
                  image={post.author?.image}
                  size={40}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink hover:underline">
                    {post.author?.name || "Someone"}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {timeAgo(post.createdAt)}
                  </span>
                </span>
              </Link>
            </ProfileHover>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar name={null} image={null} size={40} />
              <span className="text-sm font-bold text-ink">Someone</span>
            </div>
          )}
        </div>

        {/* Caption */}
        {(post.title || post.content) && (
          <div className="border-b border-line px-4 py-3">
            {post.title && (
              <p className="text-sm font-bold text-ink">{post.title}</p>
            )}
            {post.content && (
              <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm text-ink-muted">
                {post.content}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="border-b border-line px-2 py-1">
          <PostActions
            postId={post.id}
            likes={actions.likes}
            dislikes={actions.dislikes}
            comments={actions.comments}
            liked={actions.liked}
            disliked={actions.disliked}
            bookmarked={actions.bookmarked}
            signedIn={actions.signedIn}
            isOwner={actions.isOwner}
          />
        </div>

        {/* Comments */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {comments === null ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3">
                  <span className="h-8 w-8 animate-pulse rounded-full bg-soft" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-soft" />
                    <div className="h-3 w-full animate-pulse rounded bg-soft" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-faint">
              No comments yet — be the first to reply.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar
                    name={c.author?.name}
                    image={c.author?.image}
                    size={32}
                  />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/profile/${c.author?.id}`}
                        className="truncate text-[13px] font-bold text-ink hover:underline"
                      >
                        {c.author?.name || "Unknown"}
                      </Link>
                      <span className="shrink-0 text-[11px] text-ink-faint">
                        {timeAgo(c.createdAt)}
                      </span>
                      <ReportMenu
                        targetType="COMMENT"
                        targetId={c.id}
                        className="ml-auto"
                      />
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-ink-soft">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reply box */}
        <div className="border-t border-line p-3">
          <CommentComposer postId={post.id} />
        </div>
      </aside>
    </div>,
    document.body
  );
}

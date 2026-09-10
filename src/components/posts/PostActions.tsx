"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  toggleReaction,
  toggleBookmark,
  reportPost,
} from "@/app/actions";
import { PencilIcon } from "@/components/ui/Icons";

type Props = {
  postId: string;
  likes: number;
  dislikes: number;
  comments: number;
  liked?: boolean;
  disliked?: boolean;
  bookmarked?: boolean;
  signedIn: boolean;
  variant?: "card" | "detail";
  /** Viewer is the post author — enables inline Delete (feed cards only). */
  isOwner?: boolean;
};

// Full action row for a post:
//   heart (like) · heartbreak (dislike) · comment · bookmark · report · [delete]
export function PostActions({
  postId,
  likes,
  dislikes,
  comments,
  liked,
  disliked,
  bookmarked,
  signedIn,
  variant = "card",
  isOwner = false,
}: Props) {
  const [state, setState] = useState({
    likes,
    dislikes,
    liked: !!liked,
    disliked: !!disliked,
    bookmarked: !!bookmarked,
  });
  // Own busy flag instead of useTransition: async server actions in
  // startTransition can leave isPending stuck on React 18.3 + Next 15,
  // which disabled every button after the first click until a reload.
  const [pending, setPending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // ⋯ menu state (share / save / report live here, not on the row).
  const [menuOpen, setMenuOpen] = useState(false);
  // Portal anchor: the menu renders in document.body (fixed, from the
  // button rect) so no overflow-hidden card ancestor can clip it.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number; sheet: boolean } | null>(null);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setMenuPos({
        // Anchored above the button (bottom-anchored so any menu height
        // grows upward); clamped into the viewport (208px menu width).
        // Narrow screens get a bottom sheet instead (see render).
        sheet: window.innerWidth < 640,
        bottom: window.innerHeight - r.top + 8,
        left: Math.max(8, Math.min(r.right - 208, window.innerWidth - 216)),
      });
    }
    setReportOpen(false);
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
    setReportOpen(false);
  }
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);

  const detailHref =
    locationPath(postId);

  async function react(type: "like" | "dislike") {
    if (!signedIn) {
      window.location.href = "/auth/signin";
      return;
    }
    if (pending) return;
    // Mirrors the server invariant: one reaction per user per post.
    // Switching replaces the opposite (and moves its count);
    // clicking the active reaction removes it.
    setState((s) => {
      if (type === "like") {
        const wasLiked = s.liked;
        const hadDislike = !wasLiked && s.disliked;
        return {
          ...s,
          liked: !wasLiked,
          disliked: false,
          likes: s.likes + (wasLiked ? -1 : 1),
          dislikes: hadDislike ? s.dislikes - 1 : s.dislikes,
        };
      }
      const wasDisliked = s.disliked;
      const hadLike = !wasDisliked && s.liked;
      return {
        ...s,
        disliked: !wasDisliked,
        liked: false,
        dislikes: s.dislikes + (wasDisliked ? -1 : 1),
        likes: hadLike ? s.likes - 1 : s.likes,
      };
    });
    setPending(true);
    try {
      await toggleReaction(postId, type);
    } catch {
      // revalidation reconciles
    } finally {
      setPending(false);
    }
  }

  async function mark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      window.location.href = "/auth/signin";
      return;
    }
    if (pending) return;
    const next = !state.bookmarked;
    setState((s) => ({ ...s, bookmarked: next }));
    setPending(true);
    try {
      await toggleBookmark(postId);
    } catch {
      setState((s) => ({ ...s, bookmarked: !next }));
    } finally {
      setPending(false);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.origin + detailHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  // Owner edit from the feed — jumps into the composer's edit mode
  // (/new?edit=<id>, same entry point as the detail page OwnerControls).
  // Deletion stays on the detail page only.

  async function submitReport(reason: string) {
    if (pending) return;
    setPending(true);
    try {
      await reportPost(postId, reason);
      setReported(true);
      closeMenu();
      setTimeout(() => setReported(false), 2500);
    } catch {
    } finally {
      setPending(false);
    }
  }

  const icon = variant === "detail" ? "h-[22px] w-[22px]" : "h-5 w-5";
  const btn =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-faint transition-colors";

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Heart */}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          react("like");
        }}
        className={`${btn} ${state.liked ? "!text-rose-500" : "hover:bg-soft hover:text-ink-soft"}`}
        aria-label="Love"
        aria-pressed={state.liked}
      >
        <HeartIcon className={icon} filled={state.liked} />
        {(state.likes || null) && <span>{state.likes}</span>}
      </button>

      {/* Heartbreak */}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          react("dislike");
        }}
        className={`${btn} ${state.disliked ? "!text-indigo-400" : "hover:bg-soft hover:text-ink-soft"}`}
        aria-label="Heartbreak"
        aria-pressed={state.disliked}
      >
        <BrokenHeartIcon className={icon} filled={state.disliked} />
        {(state.dislikes || null) && <span>{state.dislikes}</span>}
      </button>

      {/* Reply count lives on the right-side "N replies" link — no duplicate
          bubble here. */}

      {/* ⋯ — share / save / report live in here, keeping the row to
          hearts + owner edit. */}
      <div>
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (menuOpen) closeMenu();
            else openMenu();
          }}
          className={`${btn} hover:bg-soft hover:text-ink-soft`}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More actions"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>

        {menuOpen &&
          menuPos &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <span
                className="fixed inset-0 z-[70] cursor-default bg-black/50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeMenu();
                }}
              />
              <div
                role="menu"
                className={
                  menuPos.sheet
                    ? "card fixed inset-x-3 bottom-3 z-[80] bg-surface p-2 pb-5 shadow-lg"
                    : "card fixed z-[80] w-52 bg-surface p-2 shadow-lg"
                }
                style={
                  menuPos.sheet
                    ? undefined
                    : { bottom: menuPos.bottom, left: menuPos.left }
                }
                onClick={(e) => e.stopPropagation()}
              >
              {!reportOpen ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={share}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink"
                  >
                    {copied ? "✓ Link copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={mark}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink disabled:opacity-50"
                  >
                    {state.bookmarked ? "★ Saved — tap to unsave" : "☆ Save post"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!signedIn) {
                        window.location.href = "/auth/signin";
                        return;
                      }
                      setReportOpen(true);
                    }}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-warm transition-colors hover:bg-soft"
                  >
                    {reported ? "✓ Reported" : "Report"}
                  </button>
                </>
              ) : (
                <>
                  <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-ink-secondary">
                    Why are you reporting this?
                  </p>
                  {["Spam or scam", "Harassment", "Inappropriate content", "Misinformation"].map(
                    (r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={pending}
                        onClick={() => submitReport(r)}
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink"
                      >
                        {r}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-faint transition-colors hover:bg-soft"
                  >
                    Back
                  </button>
                </>
              )}
              </div>
            </>,
            document.body
          )}
      </div>

      {/* Owner edit — feed cards only; deletion lives on the detail
          page's OwnerControls (edit+delete together there). */}
      {isOwner && variant === "card" && (
        <Link
          href={`/new?edit=${postId}`}
          onClick={(e) => e.stopPropagation()}
          className={`${btn} hover:bg-soft hover:text-accent`}
          aria-label="Edit post"
          title="Edit post"
        >
          <PencilIcon className={icon} />
        </Link>
      )}
    </div>
  );
}

function locationPath(postId: string) {
  return "#";
}

function HeartIcon({ className, filled }: { className: string; filled: boolean }) {
  return (
    <svg
      className={`${className} ${filled ? "scale-105" : ""} transition-transform`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BrokenHeartIcon({ className, filled }: { className: string; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0L12 5.36l-.77-.78a5.4 5.4 0 0 0-7.65 7.65l1.02 1.02L12 21.23l7.4-7.98 1.02-1.02a5.4 5.4 0 0 0 0-7.65z" />
      <polyline
        points="13.5 5.5 10.5 10 14 11.5 10.8 16"
        stroke={filled ? "#121212" : "currentColor"}
        strokeWidth={filled ? 1.6 : 2}
        fill="none"
      />
    </svg>
  );
}

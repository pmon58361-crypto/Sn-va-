"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      // Pull fresh server data immediately — otherwise the tap looks dead
      // until the next navigation (same fix as Sn-va--main).
      router.refresh();
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
      router.refresh();
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
                className="fixed inset-0 z-[70] cursor-default bg-black/30"
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
                    :                   "card fixed z-[80] w-56 rounded-xl bg-surface p-1.5 shadow-xl ring-1 ring-line"
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1">{copied ? "Link copied" : "Copy link"}</span>
                    {copied && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={mark}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-soft disabled:opacity-50 ${state.bookmarked ? "font-semibold text-accent" : "text-ink-soft hover:text-ink"}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={state.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1">Bookmark</span>
                    {state.bookmarked && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div aria-hidden className="mx-2.5 my-1.5 h-px bg-line" />
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-warm-tint hover:text-warm"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M5 21V4" strokeLinecap="round" />
                      <path d="M5 4h13l-2.5 4L18 12H5" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1 font-medium">{reported ? "Reported" : "Report"}</span>
                    {reported && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink"
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

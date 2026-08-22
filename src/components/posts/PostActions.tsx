"use client";

import { useState } from "react";
import { toggleReaction, toggleBookmark, reportPost } from "@/app/actions";

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
};

// Full action row for a post:
//   heart (like) · heartbreak (dislike) · comment · bookmark · report
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

  async function submitReport(reason: string) {
    if (pending) return;
    setPending(true);
    try {
      await reportPost(postId, reason);
      setReported(true);
      setReportOpen(false);
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

      {/* Share */}
      <button type="button" onClick={share} className={`${btn} hover:bg-soft hover:text-accent`} title="Copy link">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {copied ? <path d="M20 6L9 17l-5-5" /> : <><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></>}
        </svg>
      </button>

      {/* Bookmark */}
      <button
        type="button"
        disabled={pending}
        onClick={mark}
        className={`${btn} ${state.bookmarked ? "!text-accent" : "hover:bg-soft hover:text-accent"}`}
        aria-label="Bookmark"
        aria-pressed={state.bookmarked}
      >
        <BookmarkIcon className={icon} filled={state.bookmarked} />
      </button>

      {/* Report */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!signedIn) {
              window.location.href = "/auth/signin";
              return;
            }
            setReportOpen((o) => !o);
          }}
          className={`${btn} ${reported ? "!text-warm" : "hover:bg-soft hover:text-warm"}`}
          aria-label="Report post"
          title={reported ? "Reported — moderators will review" : "Report"}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
          </svg>
        </button>

        {reportOpen && (
          <div
            className="card absolute bottom-full right-0 z-30 mb-2 w-52 bg-surface p-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
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
          </div>
        )}
      </div>
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

function BookmarkIcon({ className, filled }: { className: string; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

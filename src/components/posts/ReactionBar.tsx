"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { toggleReaction } from "@/app/actions";

type Props = {
  postId: string;
  likes: number;
  dislikes?: number; // accepted for backward compat, unused in the heart UI
  viewerReaction?: "like" | "dislike" | null;
  variant?: "card" | "detail";
};

/**
 * Instagram-style heart. A single tap toggles love on/off.
 * Optimistic via local state + useTransition; the server action persists
 * and revalidation reconciles any revert.
 *
 * NOTE: previously used React 19's useOptimistic, which does not exist
 * in React 18.3.1 and crashed on every click. Replaced with useState.
 */
export function ReactionBar({
  postId,
  likes,
  viewerReaction,
  variant = "card",
}: Props) {
  const { status } = useSession();
  const [pending, startTransition] = useTransition();
  const [loved, setLoved] = useState<boolean>(viewerReaction === "like");

  // Derive the visible count: strip the server's view, apply local.
  const count =
    likes - (viewerReaction === "like" ? 1 : 0) + (loved ? 1 : 0);

  const handle = () => {
    if (status !== "authenticated") {
      window.location.href = "/auth/signin";
      return;
    }
    const next = !loved;
    setLoved(next);
    startTransition(async () => {
      try {
        await toggleReaction(postId);
      } catch {
        // revalidation reverts on failure
      }
    });
  };

  const iconSize = variant === "detail" ? "h-6 w-6" : "h-5 w-5";
  const pad = variant === "detail" ? "px-3.5 py-2" : "px-3 py-1.5";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handle}
      className={`inline-flex items-center gap-1.5 rounded-lg ${pad} text-sm font-medium transition-all ${
        loved
          ? "text-rose-500"
          : "text-ink-faint hover:bg-soft hover:text-ink-soft"
      }`}
      aria-label={loved ? "Unlike" : "Like"}
      aria-pressed={loved}
    >
      <HeartIcon className={iconSize} filled={loved} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

// Filled vs outline heart. Filled gets a tiny scale pop on the loved state.
function HeartIcon({
  className,
  filled,
}: {
  className: string;
  filled: boolean;
}) {
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

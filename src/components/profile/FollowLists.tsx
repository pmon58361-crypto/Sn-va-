"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";

/**
 * Followers / following lists behind the profile counts. Tap a count →
 * bottom-sheet modal with avatars, names, and live follow buttons.
 * Fetched on open (counts are public; rows carry viewer follow state).
 */
export function FollowLists({
  userId,
  followers,
  following,
}: {
  userId: string;
  followers: number;
  following: number;
}) {
  const [open, setOpen] = useState<"followers" | "following" | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen("followers")}
        className="whitespace-nowrap rounded-lg px-1 py-0.5 transition hover:text-ink"
      >
        <b className="font-bold text-ink">{followers}</b>{" "}
        {followers === 1 ? "follower" : "followers"}
      </button>
      <button
        type="button"
        onClick={() => setOpen("following")}
        className="whitespace-nowrap rounded-lg px-1 py-0.5 transition hover:text-ink"
      >
        <b className="font-bold text-ink">{following}</b> following
      </button>

      {open && (
        <FollowModal userId={userId} kind={open} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

type Row = {
  id: string;
  name: string | null;
  image: string | null;
  followedByMe: boolean;
  isMe: boolean;
};

function FollowModal({
  userId,
  kind,
  onClose,
}: {
  userId: string;
  kind: "followers" | "following";
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${userId}/follows?kind=${kind}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setRows(Array.isArray(d?.users) ? d.users : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={kind === "followers" ? "Followers" : "Following"}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[75vh] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <p className="flex-1 text-sm font-bold text-ink">
            {kind === "followers" ? "Followers" : "Following"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-full text-lg text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {rows === null ? (
            <p className="px-4 py-8 text-center text-sm text-ink-faint">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-faint">
              Nobody here yet.
            </p>
          ) : (
            rows.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-soft"
              >
                <Link
                  href={`/profile/${u.id}`}
                  onClick={onClose}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar name={u.name} image={u.image} size={38} />
                  <span className="truncate text-sm font-semibold text-ink">
                    {u.name || "Unknown"}
                  </span>
                </Link>
                {!u.isMe && (
                  <FollowButton
                    targetUserId={u.id}
                    following={u.followedByMe}
                    className="!px-4 !py-1.5 !text-xs"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

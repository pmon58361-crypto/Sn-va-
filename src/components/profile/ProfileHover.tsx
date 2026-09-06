"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/profile/FollowButton";

type MiniProfile = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  location: string | null;
  followers: number;
  posts: number;
  following: boolean;
  self: boolean;
  private: boolean;
};

// Module-level cache: one fetch per user per page lifetime.
const cache = new Map<string, Promise<MiniProfile | null>>();

function loadMini(userId: string): Promise<MiniProfile | null> {
  const hit = cache.get(userId);
  if (hit) return hit;
  const p = fetch(`/api/profile/${userId}`, { cache: "force-cache" })
    .then((r) => (r.ok ? (r.json() as Promise<MiniProfile>) : null))
    .catch(() => null);
  cache.set(userId, p);
  return p;
}

const OPEN_DELAY_MS = 350;

/**
 * ProfileHover — hover any child (avatar, name, row) to reveal a mini
 * profile card. The card renders in a body portal so triggers can stay
 * inside parent links without invalid nested-interactive HTML.
 * Touch devices: first tap still follows the link (no hover trap).
 */
export function ProfileHover({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MiniProfile | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch devices have no hover — never trap the tap.
  const canHover =
    typeof window !== "undefined" &&
    window.matchMedia?.("(hover: hover)").matches;

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onEnter() {
    if (!canHover) return;
    cancel();
    timer.current = setTimeout(() => {
      const el = triggerRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const cardW = 300;
        const left = Math.max(
          8,
          Math.min(r.left + window.scrollX, window.innerWidth - cardW - 8)
        );
        setPos({
          top: r.bottom + window.scrollY + 8,
          left,
        });
      }
      setOpen(true);
      loadMini(userId).then((d) => d && setData(d));
    }, OPEN_DELAY_MS);
  }

  function onLeave() {
    cancel();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    // Capture scroll anywhere (the card is fixed to the trigger position).
    document.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open ]);

  useEffect(() => cancel, []);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className="contents"
      >
        {children}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={cancel}
            onMouseLeave={onLeave}
            className="card z-[80] w-[300px] p-4 shadow-xl"
            style={{ position: "absolute", top: pos.top, left: pos.left }}
          >
            {!data ? (
              <div className="flex items-center gap-3">
                <span className="h-12 w-12 animate-pulse rounded-full bg-soft" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-soft" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-soft" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <Avatar name={data.name} image={data.image} size={48} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${data.id}`}
                      className="block truncate text-[15px] font-bold text-ink hover:underline"
                    >
                      {data.name || "Someone"}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      {data.followers}{" "}
                      {data.followers === 1 ? "follower" : "followers"} ·{" "}
                      {data.posts} {data.posts === 1 ? "post" : "posts"}
                      {data.location ? ` · ${data.location}` : ""}
                    </p>
                  </div>
                </div>
                {data.private ? (
                  <p className="mt-2 text-xs text-ink-faint">
                    This profile is private.
                  </p>
                ) : (
                  data.bio && (
                    <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-ink-muted">
                      {data.bio}
                    </p>
                  )
                )}
                {!data.self && !data.private && (
                  <div className="mt-3">
                    <FollowButton
                      targetUserId={data.id}
                      following={data.following}
                      className="w-full !px-4 !py-1.5 !text-sm"
                    />
                  </div>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

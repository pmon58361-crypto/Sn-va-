"use client";

import { useState } from "react";
import { toggleFollow } from "@/app/actions";

export function FollowButton({
  targetUserId,
  following,
  className = "",
}: {
  targetUserId: string;
  following: boolean;
  className?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(following);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setPending(true);
    try {
      await toggleFollow(targetUserId);
    } catch {
      setIsFollowing(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        (isFollowing
          ? "btn-outline px-5 py-2 text-sm "
          : "btn-primary px-6 py-2 text-sm ") + className
      }
    >
      {pending ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}

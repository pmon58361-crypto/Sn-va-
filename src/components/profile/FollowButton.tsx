"use client";

import { useState, useTransition } from "react";
import { toggleFollow } from "@/app/actions";

export function FollowButton({
  targetUserId,
  following,
}: {
  targetUserId: string;
  following: boolean;
}) {
  const [isFollowing, setIsFollowing] = useState(following);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isFollowing;
    setIsFollowing(next);
    startTransition(async () => {
      try {
        await toggleFollow(targetUserId);
      } catch {
        setIsFollowing(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        isFollowing
          ? "btn-outline px-5 py-2 text-sm"
          : "btn-primary px-6 py-2 text-sm"
      }
    >
      {pending ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}

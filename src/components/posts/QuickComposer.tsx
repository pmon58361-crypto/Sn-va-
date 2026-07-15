"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Compact inline composer that sits at the top of the social feed.
 * Clicking it routes to the full /new composer. Mirrors the
 * "What's on your mind?" pattern from Facebook.
 */
export function QuickComposer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [focused, setFocused] = useState(false);

  if (!session?.user) return null;

  return (
    <div className="card mb-6 p-4">
      <div className="flex items-center gap-3">
        <Avatar
          name={session.user.name}
          image={session.user.image}
          size={40}
        />
        <button
          onClick={() => router.push("/new")}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`input flex-1 cursor-text text-left transition-all ${
            focused ? "border-accent" : ""
          }`}
        >
          <span className="text-ink-faint">
            Share something with the community…
          </span>
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          Post
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/new?category=COMMUNITY")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-soft hover:text-accent"
          >
            Story
          </button>
          <button
            onClick={() => router.push("/new?category=JOB_OFFER")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-soft hover:text-accent"
          >
            Offer
          </button>
          <button
            onClick={() => router.push("/new?category=JOB_LISTING")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-soft hover:text-accent"
          >
            Job
          </button>
        </div>
      </div>
    </div>
  );
}

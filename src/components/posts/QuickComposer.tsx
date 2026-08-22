"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/Avatar";
import { NoteModal } from "@/components/stories/NoteModal";

/**
 * Compact inline composer that sits at the top of the social feed.
 * Clicking it routes to the full /new composer. Mirrors the
 * "What's on your mind?" pattern from Facebook.
 * The Story button opens an Instagram-Notes-style quick note modal.
 */
export function QuickComposer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (!session?.user) return null;

  return (
    <div className="card mb-6 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          title="Add a note"
          aria-label="Add a note"
          className="rounded-full transition-transform hover:scale-105"
        >
          <Avatar
            name={session.user.name}
            image={session.user.image}
            size={40}
          />
        </button>
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
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          Create
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            title="Share a quick note"
            onClick={() => setNoteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:bg-accent-tint hover:text-accent"
          >
            Story
          </button>
          {[
            { label: "Offer", hint: "Offer your skills", href: "/new?category=JOB_OFFER" },
            { label: "Job", hint: "Post an opening", href: "/new?category=JOB_LISTING" },
          ].map(({ label, hint, href }) => (
            <button
              key={label}
              title={hint}
              onClick={() => router.push(href)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:bg-accent-tint hover:text-accent"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {noteOpen && (
        <NoteModal
          name={session.user.name}
          image={session.user.image}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </div>
  );
}

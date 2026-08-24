"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/Avatar";
import { NoteModal } from "@/components/stories/NoteModal";

/**
 * The note composer — the whole card is one big note button
 * (Instagram-Notes-style modal on click). Full posts live at /new,
 * reachable from the + button in the nav.
 */
export function QuickComposer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);

  if (!session?.user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setNoteOpen(true)}
        aria-label="Add a note"
        className="card mb-6 flex w-full items-center gap-3 p-4 text-left transition hover:border-accent/60"
      >
        <Avatar
          name={session.user.name}
          image={session.user.image}
          size={40}
        />
        <span className="input flex-1 cursor-text truncate">
          <span className="text-ink-faint">Share a quick note…</span>
        </span>
      </button>

      {noteOpen && (
        <NoteModal
          name={session.user.name}
          image={session.user.image}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </>
  );
}

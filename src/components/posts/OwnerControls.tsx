"use client";

import { useState } from "react";
import Link from "next/link";
import { deletePost } from "@/app/actions";
import { TrashIcon } from "@/components/ui/Icons";

// Author-only edit/delete row on a post detail page.
export function OwnerControls({
  postId,
  category,
}: {
  postId: string;
  category: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      // deletePost redirects on success; the thrown digest is expected.
      await deletePost(postId);
    } catch (err) {
      const digest = (err as { digest?: string })?.digest;
      if (
        (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) ||
        (err instanceof Error && err.message === "NEXT_REDIRECT")
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : "Delete failed");
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {confirming ? (
        <>
          <span className="text-xs text-warm">Delete this post?</span>
          <button
            onClick={onDelete}
            disabled={pending}
            className="rounded-lg border border-warm px-3 py-1 text-xs font-semibold text-warm transition hover:bg-warm-tint disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="btn-ghost px-3 py-1 text-xs"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <Link
            href={`/new?edit=${postId}`}
            className="rounded-lg border border-line-strong px-3 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
          >
            Edit
          </Link>
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete post"
            title="Delete post"
            className="flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1 text-xs font-medium text-ink-muted transition hover:border-warm hover:text-warm"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Delete
          </button>
        </>
      )}
      {error && <span className="text-xs text-warm">{error}</span>}
      {/* category kept for future section-aware behavior */}
      <span hidden>{category}</span>
    </div>
  );
}

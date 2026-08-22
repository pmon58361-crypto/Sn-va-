"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStory } from "@/app/stories/actions";
import { Avatar } from "@/components/ui/Avatar";

// Instagram-Notes-style story: a short text bubble over your avatar.
// Reuses the existing createStory action (text-only mode) so notes expire
// with the same 24h TTL and appear in the regular StoriesBar.
export function NoteModal({
  name,
  image,
  onClose,
}: {
  name?: string | null;
  image?: string | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const MAX = 150;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function share() {
    if (pending || !note.trim()) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("caption", note.trim());
      form.append("bg", "#1d9bf0");
      const res = await createStory(form);
      if (!res.ok) {
        setError(res.error || "Failed to share");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="New note"
      >
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">New note</h3>
          <button
            onClick={onClose}
            className="rounded-full px-2 text-xl leading-none hover:bg-surface-hover"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Live preview: speech bubble over your avatar */}
        <div className="flex flex-col items-center">
          <div className="relative mb-1 flex w-full justify-center">
            <div
              className={`max-w-[280px] rounded-2xl px-5 py-3 text-center text-sm font-medium text-white ${
                note.trim() ? "" : "opacity-60"
              }`}
              style={{ background: "#1d9bf0" }}
            >
              {note.trim() || "First note in a while…"}
            </div>
            <span
              aria-hidden
              className="absolute -bottom-1.5 h-3 w-3 rotate-45 rounded-sm"
              style={{ background: "#1d9bf0" }}
            />
          </div>
          <Avatar name={name} image={image} size={88} />
          <p className="mt-2 text-xs text-ink-faint">Your note</p>
        </div>

        {/* Input */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX))}
          rows={2}
          maxLength={MAX}
          placeholder="First note in a while…"
          autoFocus
          className="input mt-6 resize-none"
        />
        <p className="-mt-1 mb-4 text-right text-xs tabular-nums text-ink-faint">
          {note.length}/{MAX}
        </p>

        {error && (
          <p className="mb-3 rounded-xl border border-warm bg-warm-tint px-4 py-2.5 text-sm text-warm">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <span className="text-xs text-ink-faint">
            Disappears in 24 hours
          </span>
          <button
            onClick={share}
            disabled={pending || !note.trim()}
            className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

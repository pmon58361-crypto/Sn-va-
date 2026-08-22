"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createStory } from "@/app/stories/actions";
import { Avatar } from "@/components/ui/Avatar";

// Instagram-Notes-style story: a short text bubble over your avatar.
// Uses the viewer's own accent color so it never clashes with their theme.
// Reuses the existing createStory action (text-only mode) — 24h TTL.
export function NoteModal({
  name,
  image,
  onClose,
}: {
  name?: string | null;
  image?: string | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const accent = /^#[0-9a-fA-F]{6}$/.test(session?.user?.accent || "")
    ? (session!.user!.accent as string)
    : "#1d9bf0";

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
      form.append("bg", accent);
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
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">New note</h3>
          <button
            onClick={onClose}
            className="rounded-full px-2 text-xl leading-none hover:bg-surface-hover"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Live preview: bubble over avatar */}
        <div className="flex flex-col items-center pb-6 pt-2">
          <div className="relative mb-1 flex w-full justify-center px-8">
            {note.trim() ? (
              <div
                className="max-w-[280px] rounded-2xl px-5 py-3 text-center text-[15px] font-semibold text-white shadow-lg"
                style={{ background: accent }}
              >
                {note.trim()}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-line-strong px-5 py-3 text-center text-[15px] text-ink-faint">
                Your note appears here
              </div>
            )}
            <span
              aria-hidden
              className="absolute -bottom-1.5 h-3 w-3 rotate-45 rounded-sm"
              style={{
                background: note.trim() ? accent : "var(--line-strong)",
              }}
            />
          </div>
          <Avatar name={name} image={image} size={88} />
        </div>

        {/* Input */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX))}
          rows={3}
          maxLength={MAX}
          placeholder="Share a quick thought…"
          autoFocus
          className="input resize-none"
        />

        {error && (
          <p className="mb-3 mt-3 rounded-xl border border-warm bg-warm-tint px-4 py-2.5 text-sm text-warm">
            {error}
          </p>
        )}

        {/* Footer: hint + counter + Share */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-ink-faint">Disappears in 24h</span>
          <span className="text-xs tabular-nums text-ink-faint">
            {note.length}/{MAX}
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

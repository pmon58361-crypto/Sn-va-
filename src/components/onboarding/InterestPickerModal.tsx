"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveInterests } from "@/app/actions";
import { InterestChips } from "./InterestChips";
import { normalizeInterests } from "@/lib/utils";

/**
 * Once-per-user onboarding: "tell us what you're into".
 * Rendered by the community page only while settings.interests is null,
 * so answering or skipping makes it disappear forever. Never blocking —
 * the feed works fine with zero picks.
 */
export function InterestPickerModal({
  suggestions,
}: {
  suggestions: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle(tag: string) {
    setSelected((s) =>
      s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]
    );
  }

  function addCustom() {
    const [t] = normalizeInterests([custom]);
    if (t && !selected.includes(t)) setSelected((s) => [...s, t]);
    setCustom("");
  }

  async function submit(picks: string[]) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await saveInterests(picks);
      // Hide immediately — router.refresh() is only for the feed behind
      // the sheet and may lag; the user must never see a dead button.
      setDone(true);
      router.refresh();
    } catch {
      setPending(false);
      setError("That didn't save. Check your connection and try again.");
    }
  }

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pick your interests"
    >
      <div className="w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl">
        <h2 className="text-xl font-bold tracking-tight text-ink">
          What are you into?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Pick a few topics and your For you feed will lean into them. You
          can change these anytime in Settings.
        </p>

        <div className="mt-4 max-h-[38vh] overflow-y-auto pr-1">
          <InterestChips
            suggestions={suggestions}
            selected={selected}
            onToggle={toggle}
          />
        </div>

        {selected.length > 0 && selected.length < 3 && (
          <p className="mt-2 text-xs text-ink-faint">
            Pick 3 for a sharper feed.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            maxLength={40}
            placeholder="Add a topic…"
            aria-label="Add a topic"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="btn-outline shrink-0 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-warm">{error}</p>
        )}

        <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={() => submit(selected)}
            disabled={pending}
            className="btn-primary"
          >
            Tune my feed
          </button>
          <button
            type="button"
            onClick={() => submit([])}
            disabled={pending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { saveInterests } from "@/app/actions";
import { InterestChips } from "./InterestChips";
import { CheckIcon } from "@/components/ui/Icons";
import { normalizeInterests, MAX_INTERESTS } from "@/lib/utils";

/**
 * Settings "Interests" tab body. Saves through its own action so picking
 * topics never forces a full-profile save; empty list is a valid state.
 */
export function InterestsEditor({
  initial,
  suggestions,
}: {
  initial: string[];
  suggestions: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(tag: string) {
    setSelected((s) =>
      s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]
    );
    setSaved(false);
    setError(null);
  }

  function addCustom() {
    const [t] = normalizeInterests([custom]);
    if (t && !selected.includes(t)) {
      setSelected((s) => (s.length >= MAX_INTERESTS ? s : [...s, t]));
      setSaved(false);
      setError(null);
    }
    setCustom("");
  }

  async function onSave() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await saveInterests(selected);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <section role="tabpanel" aria-label="Interests">
      <p className="text-sm text-ink-muted">
        Topics you pick get extra weight in your For you feed.
      </p>

      <div className="mt-4 max-h-[50vh] overflow-y-auto pr-1">
        <InterestChips
          suggestions={suggestions}
          selected={selected}
          onToggle={toggle}
        />
      </div>

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

      {selected.length === 0 && (
        <p className="mt-3 text-sm text-ink-faint">
          No interests yet — your feed runs on what you react to.
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="btn-primary"
        >
          Save interests
        </button>
        {saved && !error && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
            <CheckIcon className="h-4 w-4" /> Saved
          </span>
        )}
        {error && <span className="text-sm font-medium text-warm">{error}</span>}
      </div>
    </section>
  );
}

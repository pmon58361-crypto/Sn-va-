"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createChallenge,
  endChallenge,
  deleteChallenge,
} from "@/app/admin/actions";

export type ManagerChallenge = {
  id: string;
  title: string;
  prompt: string | null;
  startsAt: string;
  endsAt: string | null;
  entries: number;
};

export function ChallengeManager({
  initial,
}: {
  initial: ManagerChallenge[];
}) {
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("title", title);
    form.set("prompt", prompt);
    form.set("endsAt", endsAt);
    const res = await createChallenge(form);
    setPending(false);
    if (!res.ok) {
      setError(res.error || "Create failed");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="card space-y-3 p-4">
        <h2 className="text-sm font-bold text-ink">New challenge</h2>
        {error && <p className="text-sm text-warm">{error}</p>}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Ship something tiny"
          required
          maxLength={120}
          className="input"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt — what should people build or share? (optional)"
          rows={3}
          maxLength={2000}
          className="input resize-y"
        />
        <label className="block text-xs text-ink-muted">
          Ends at (optional — leave empty for open-ended)
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="input mt-1"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create challenge"}
        </button>
      </form>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-ink-muted">No challenges yet.</p>
        )}
        {items.map((c) => {
          const live = !c.endsAt || new Date(c.endsAt).getTime() > Date.now();
          return (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/challenges/${c.id}`}
                  className="font-bold text-ink hover:underline"
                >
                  {c.title}
                </Link>
                <span className="badge bg-[var(--bg-soft)] text-xs capitalize text-ink-muted">
                  {live ? "live" : "ended"}
                </span>
                <span className="font-mono text-xs text-ink-faint">
                  {c.entries} {c.entries === 1 ? "entry" : "entries"}
                </span>
              </div>
              {c.prompt && (
                <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                  {c.prompt}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {live && (
                  <button
                    onClick={async () => {
                      await endChallenge(c.id);
                      window.location.reload();
                    }}
                    className="btn-outline px-3 py-1.5 text-xs"
                  >
                    End now
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!window.confirm("Delete this challenge? Entries survive as ordinary posts.")) return;
                    await deleteChallenge(c.id);
                    setItems((prev) => prev.filter((x) => x.id !== c.id));
                  }}
                  className="px-3 py-1.5 text-xs text-warm hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { votePoll } from "@/app/actions";

export type PollData = {
  id: string;
  question: string;
  options: unknown; // JSON column: [{ id: string; label: string }]
  votes: { optionId: string; userId: string }[];
};

type Opt = { id: string; label: string };

function parseOptions(raw: unknown): Opt[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is Opt =>
      !!o &&
      typeof o === "object" &&
      typeof (o as Opt).id === "string" &&
      typeof (o as Opt).label === "string"
  );
}

// One-tap poll on a post. Pre-vote: clickable option rows. After voting (or
// for the post author): real result bars with counts. One vote per user;
// switching updates in place server-side.
export function PollBox({
  poll,
  meId,
  forceResults,
}: {
  poll: PollData;
  meId?: string | null;
  /** Post authors see totals without voting. */
  forceResults?: boolean;
}) {
  const options = parseOptions(poll.options);
  const [votedOption, setVotedOption] = useState<string | null>(
    poll.votes.find((v) => v.userId === meId)?.optionId ?? null
  );
  // Local tally starts from the SSR/prefetched truth, then moves optimistically.
  const [tally, setTally] = useState<Record<string, number>>(() => {
    const t: Record<string, number> = {};
    for (const v of poll.votes) t[v.optionId] = (t[v.optionId] ?? 0) + 1;
    return t;
  });
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  if (options.length === 0) return null;

  function vote(optionId: string) {
    if (votedOption || pending) return;
    setVotedOption(optionId);
    setTally((t) => ({ ...t, [optionId]: (t[optionId] ?? 0) + 1 }));
    startTransition(async () => {
      try {
        await votePoll(poll.id, optionId);
        router.refresh();
      } catch {
        // Revert on failure; next render shows the honest pre-vote state.
        setFailed(true);
        setVotedOption(null);
        setTally((t) => ({
          ...t,
          [optionId]: Math.max(0, (t[optionId] ?? 1) - 1),
        }));
      }
    });
  }

  const total = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <div
      className="mt-3 rounded-xl border border-line bg-soft/60 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-sm font-semibold text-ink">{poll.question}</p>

      <div className="mt-2 space-y-1.5">
        {options.map((o) => {
          const count = tally[o.id] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = votedOption === o.id;

          if (!votedOption && !failed && !forceResults) {
            return (
              <button
                key={o.id}
                type="button"
                disabled={pending}
                onClick={() => vote(o.id)}
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink-soft transition hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {o.label}
              </button>
            );
          }

          return (
            <div
              key={o.id}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 text-sm ${
                mine ? "border-accent" : "border-line"
              }`}
              aria-label={`${o.label}: ${pct}%`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-accent/15 transition-[width]"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className={mine ? "font-semibold text-accent" : "text-ink-soft"}>
                  {mine ? "● " : ""}
                  {o.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {pct}% · {count}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-[11px] text-ink-faint">
        {total} {total === 1 ? "vote" : "votes"}
        {!votedOption && !forceResults && " · tap an option to vote"}
      </p>
    </div>
  );
}

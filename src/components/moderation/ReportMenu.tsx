"use client";

import { useState } from "react";
import { reportTarget } from "@/app/actions";

const REASONS = ["Spam or scam", "Harassment or abuse", "Misinformation", "Illegal content"] as const;

/**
 * Small inline report control for comments / DMs / stories.
 * Posts use PostActions' richer popover — this one is deliberately tiny.
 */
export function ReportMenu({
  targetType,
  targetId,
  className = "",
  label = "Report",
}: {
  targetType: "POST" | "COMMENT" | "MESSAGE" | "STORY";
  targetId: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  async function submit(reason: string) {
    try {
      await reportTarget({ targetType, targetId, reason });
      setDone(true);
    } catch {
      setError(true);
    }
    setOpen(false);
  }

  if (done) {
    return (
      <span className={`text-xs text-ink-faint ${className}`} aria-live="polite">
        ✓ Reported
      </span>
    );
  }

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-xs transition-colors ${
          error ? "text-warm" : "text-ink-faint hover:text-warm"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {error ? "Failed — retry?" : label}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <span
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <span
            role="menu"
            className="absolute bottom-full left-0 z-50 mb-1 block w-44 overflow-hidden rounded-xl border border-line bg-bg shadow-lg"
          >
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="menuitem"
                onClick={() => submit(r)}
                className="block w-full px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-surface-hover"
              >
                {r}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

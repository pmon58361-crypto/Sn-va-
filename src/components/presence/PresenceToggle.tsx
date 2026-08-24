"use client";

import { useEffect, useState } from "react";

// Per-browser presence opt-out. The cross-device setting ships with the
// next additive schema push (Settings.presenceOptOut) — until then this is
// honest about its scope in the description.
const KEY = "presence-optout";

export function PresenceToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(localStorage.getItem(KEY) !== "1");
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    localStorage.setItem(KEY, next ? "0" : "1");
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
    >
      <span>
        <span className="text-sm font-medium text-ink">
          Show me as online
        </span>
        <span className="block text-xs text-ink-muted">
          Online dots and activity area, on this device.
        </span>
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  onInstallPromptAvailable,
  promptInstall,
  isIos,
  isStandalone,
} from "@/components/pwa/InstallPrompt";

// Shared mobile detection: phones and tablets on the web (not the
// installed app). Single source of truth — the gate and any future
// mobile-only surfaces use this, so the definition never drifts.
export function isMobileWeb(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  if (isStandalone()) return false;
  return /mobi|android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Install button for Settings (and anywhere else): native prompt when the
// browser offers one, platform instructions otherwise. No-op when already
// installed — the button becomes a quiet confirmation instead.
export function InstallAppButton() {
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setDone(true);
      return;
    }
    if (isIos()) {
      setHint("On iPhone: Share menu → Add to Home Screen.");
      return;
    }
    setReady(true);
    return onInstallPromptAvailable(() => {});
  }, []);

  if (done) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-accent-tint px-4 py-2 text-sm font-semibold text-accent">
        <span aria-hidden>✓</span> Installed
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={!ready && !isIos()}
        onClick={async () => {
          const outcome = await promptInstall();
          if (outcome === "accepted") {
            setDone(true);
          } else if (outcome === null) {
            setHint("Use your browser menu → Install app (or Add to Home Screen).");
          }
        }}
        className="btn-primary shrink-0 px-5 py-2 text-sm disabled:opacity-50"
      >
        Install app
      </button>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </span>
  );
}

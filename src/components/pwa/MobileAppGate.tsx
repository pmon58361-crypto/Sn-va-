"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import {
  promptInstall,
  isIos,
  isStandalone,
} from "@/components/pwa/InstallPrompt";
import { isMobileWeb } from "@/components/pwa/InstallAppButton";

// Kill-switch: set false to restore the mobile website instantly, no other
// changes needed. Deliberately a constant, not env — env would need a
// rebuild to flip anyway, and this keeps the gate visible in review.
const MOBILE_WEB_GATE = true;

// Mobile-web hard gate: phones/tablets in a browser get the download
// screen INSTEAD of the app — no browsing, no dismiss. Installed app
// (standalone display mode) and every desktop browser pass straight
// through. Owner's explicit call: mobile acquisition goes through install.
export function MobileAppGate() {
  const [gated, setGated] = useState(false);
  const [manualHint, setManualHint] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);
  const mountedAt = useRef(0);
  const ios = typeof window !== "undefined" && isIos();

  useEffect(() => {
    if (!MOBILE_WEB_GATE) return;
    if (!isMobileWeb()) return;
    mountedAt.current = Date.now();
    setGated(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (gated && !isStandalone()) {
      document.body.style.overflow = "hidden";
    }
  }, [gated]);

  if (!gated) return null;

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome !== null) return;
    // No captured prompt — diagnose WHY, on-device, in plain words.
    // (1) First-ever visit: no service-worker controller yet, and Chrome
    // won't offer install until one controls the page — reload fixes it.
    // (2) Slow device: the offer can arrive seconds after paint.
    // (3) Otherwise Chrome refused — the ⋮ menu path below still applies.
    let controlled = true;
    try {
      controlled = !!navigator.serviceWorker?.controller;
    } catch {}
    if (!controlled) {
      setDiag("First load — reload this page once, then tap Download again.");
    } else if (Date.now() - mountedAt.current < 15000) {
      setDiag("Still preparing — wait a few seconds and tap again.");
    } else {
      setDiag("Chrome didn't offer install — use the ⋮ menu steps below.");
    }
    setManualHint(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download Snívať"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-bg px-6 py-10 text-center"
    >
      <Logo size={64} />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Dream. Grow. Connect.
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
        Get the Snívať app
      </h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
        Snívať lives on your home screen now — faster, full-screen, with
        notifications. The mobile website has retired.
      </p>

      <ul className="mt-5 w-full max-w-xs space-y-2 text-left">
        {[
          { t: "Community feed", d: "Builders posting proof, daily." },
          { t: "Jobs without theater", d: "Hire or get hired, no résumés." },
          { t: "DMs and groups", d: "Your people, one tap away." },
        ].map((f) => (
          <li
            key={f.t}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
          >
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-tint text-sm font-bold text-accent">
              ✓
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{f.t}</span>
              <span className="block text-xs text-ink-muted">{f.d}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 w-full max-w-xs space-y-3">
        {!ios && (
          <button
            type="button"
            onClick={install}
            className="btn-primary w-full py-3 text-base"
          >
            Download app
          </button>
        )}
        {/* Manual steps ALWAYS visible — the one-tap button depends on a
            browser event that doesn't always fire, so this path must work
            with zero JavaScript luck involved. */}
        <div className="rounded-2xl border border-line bg-surface p-4 text-left text-sm leading-relaxed text-ink-soft">
          {ios ? (
            <p>
              Tap <span className="font-semibold text-ink">Share</span>, then{" "}
              <span className="font-semibold text-ink">Add to Home Screen</span>,
              then open Snívať from your home screen.
            </p>
          ) : (
            <p>
              Open Chrome&apos;s <span className="font-semibold text-ink">⋮ menu</span>,
              tap <span className="font-semibold text-ink">Install app</span>{" "}
              (or Add to Home screen), then open it from there.
            </p>
          )}
          {manualHint && !ios && (
            <p className="mt-2 text-xs text-ink-muted">
              No Install entry? Update Chrome, then reload this page once.
            </p>
          )}
          {diag && !ios && (
            <p role="status" className="mt-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft">
              {diag}
            </p>
          )}
        </div>
      </div>

      <p className="mt-8 text-[11px] text-ink-faint">
        Already installed? Open it from your home screen.
      </p>
    </div>
  );
}

// Re-export for single-import convenience.
export { isMobileWeb };

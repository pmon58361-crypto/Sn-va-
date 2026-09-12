"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import {
  onInstallPromptAvailable,
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
  const [canPrompt, setCanPrompt] = useState(false);
  const [manualHint, setManualHint] = useState(false);
  const ios = typeof window !== "undefined" && isIos();

  useEffect(() => {
    if (!MOBILE_WEB_GATE) return;
    if (!isMobileWeb()) return;
    setGated(true);
    document.body.style.overflow = "hidden";
    const off = onInstallPromptAvailable(() => setCanPrompt(true));
    return () => {
      document.body.style.overflow = "";
      off();
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
    if (outcome === null) setManualHint(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download Snívať"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-bg px-6 py-10 text-center"
    >
      <Logo size={64} />
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
        Get the Snívať app
      </h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
        Snívať lives on your home screen now — faster, full-screen, with
        notifications. The mobile website has retired.
      </p>

      <div className="mt-6 w-full max-w-xs">
        {ios ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-soft">
            Tap <span className="font-semibold text-ink">Share</span>, then{" "}
            <span className="font-semibold text-ink">Add to Home Screen</span>,
            then open Snívať from your home screen.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={install}
              className="btn-primary w-full py-3 text-base"
            >
              Download app
            </button>
            {(manualHint || !canPrompt) && (
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                {canPrompt
                  ? "If nothing pops up, use your browser menu → Install app."
                  : "Use your browser menu → Install app (or Add to Home Screen), then open it from there."}
              </p>
            )}
          </>
        )}
      </div>

      <p className="mt-8 text-[11px] text-ink-faint">
        Already installed? Open it from your home screen.
      </p>
    </div>
  );
}

// Re-export for single-import convenience.
export { isMobileWeb };

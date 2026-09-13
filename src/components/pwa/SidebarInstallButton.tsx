"use client";

import { useEffect, useState } from "react";
import {
  isIos,
  isStandalone,
  onInstallPromptAvailable,
  promptInstall,
} from "@/components/pwa/InstallPrompt";
import { DownloadIcon } from "@/components/ui/Icons";

/**
 * Sidebar "Install app" button. Independent of the bottom banner's dismiss
 * flag. Native prompt (Android/desktop Chromium), iOS manual hint, and it
 * hides entirely once installed (standalone) or unsupported.
 *
 * Platform gap it closes: Firefox (Windows + Android) never fires
 * beforeinstallprompt, so without a fallback those users get NO install
 * entry at all. If no prompt arrives shortly after mount, we offer manual
 * steps instead (browser menu → Install). Where the app is installable the
 * prompt fires in well under a second, so the timer only trips otherwise.
 */
export function SidebarInstallButton() {
  // Hidden until we know install is possible — avoids SSR flicker.
  const [mode, setMode] = useState<"hidden" | "native" | "ios" | "manual">("hidden");
  const [hintOpen, setHintOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setMode("hidden");
      return;
    }
    const off = onInstallPromptAvailable((p) => {
      setMode(p ? "native" : isIos() ? "ios" : "hidden");
    });
    setMode((m) => (m === "native" ? m : isIos() ? "ios" : m));
    // Fallback timer: no prompt event (Firefox, suppressed prompt) means no
    // native path exists — switch to manual steps instead of staying hidden.
    // Cleared the moment a real prompt arrives via the subscription above.
    const t = window.setTimeout(() => {
      setMode((m) => (m === "hidden" ? (isIos() ? "ios" : "manual") : m));
    }, 2500);
    const onInstalled = () => {
      setInstalled(true);
      setMode("hidden");
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      off();
      window.clearTimeout(t);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden" || installed) return null;

  async function nativeInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") setInstalled(true);
  }

  return (
    <div className="relative px-3 pb-1">
      {mode === "native" ? (
        <button
          type="button"
          onClick={nativeInstall}
          className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-accent hover:text-accent"
        >
          <DownloadIcon className="h-4 w-4 shrink-0" />
          Install app
        </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setHintOpen((o) => !o)}
                aria-expanded={hintOpen}
                className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-accent hover:text-accent"
              >
                <DownloadIcon className="h-4 w-4 shrink-0" />
                Install app
              </button>
              {hintOpen && (
                <div
                  role="dialog"
                  aria-label={
                    mode === "manual"
                      ? "How to install the app"
                      : "How to install on iPhone"
                  }
                  className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-xl border border-line bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed text-ink-muted shadow-xl"
                >
                  {mode === "manual" ? (
                    <>
                      Your browser has no automatic install button — pin it
                      manually: open the <b className="text-ink">browser menu (⋮)</b>{" "}
                      and tap{" "}
                      <b className="text-ink">Install / Add to Home screen</b>.
                      On desktop use the install icon in the address bar.
                    </>
                  ) : (
                    <>
                      On iPhone: tap the <b className="text-ink">Share</b> icon in
                      Safari, then <b className="text-ink">Add to Home Screen</b>.
                    </>
                  )}
                </div>
              )}
            </>
          )}
    </div>
  );
}

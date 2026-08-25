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
 */
export function SidebarInstallButton() {
  // Hidden until we know install is possible — avoids SSR flicker.
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");
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
    const onInstalled = () => {
      setInstalled(true);
      setMode("hidden");
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      off();
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
              aria-label="How to install on iPhone"
              className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-xl border border-line bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed text-ink-muted shadow-xl"
            >
              On iPhone: tap the <b className="text-ink">Share</b> icon in
              Safari, then <b className="text-ink">Add to Home Screen</b>.
            </div>
          )}
        </>
      )}
    </div>
  );
}

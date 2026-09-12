"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "xpwa-dismiss";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

function isIos() {
  const ua = window.navigator.userAgent;
  const apple = /iphone|ipad|ipod/i.test(ua);
  const desktopTouchMac = /macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
  return apple || desktopTouchMac;
}

// ── Shared capture ──────────────────────────────────────────────────────────
// Chrome fires beforeinstallprompt ONCE per page load. The banner below and
// any other surface (e.g. the sidebar Install button) share it through this
// module-level store — the banner's dismiss flag does NOT affect others.
let capturedPrompt: BeforeInstallPromptEvent | null = null;
type PromptListener = (p: BeforeInstallPromptEvent | null) => void;
const promptListeners = new Set<PromptListener>();

/** Subscribe to the deferred install prompt. Fires immediately if already captured. */
export function onInstallPromptAvailable(fn: PromptListener): () => void {
  promptListeners.add(fn);
  if (capturedPrompt) fn(capturedPrompt);
  return () => {
    promptListeners.delete(fn);
  };
}

/** Fire the native install prompt; null when no deferred prompt exists. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  // Inline head capture first (earliest), module listener second.
  const inline =
    typeof window !== "undefined"
      ? ((window as unknown as { __bip?: BeforeInstallPromptEvent | null }).__bip ?? null)
      : null;
  const source = inline ?? capturedPrompt;
  if (!source) return null;
  const clearInline = () => {
    if (typeof window !== "undefined") {
      (window as unknown as { __bip?: BeforeInstallPromptEvent | null }).__bip = null;
    }
    capturedPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  };
  try {
    await source.prompt();
  } catch {
    // A captured prompt is single-use (and Chrome can invalidate it on
    // navigation): a second tap must fall through to manual steps, never
    // throw into the click handler.
    clearInline();
    return null;
  }
  const { outcome } = await source.userChoice;
  // Resolved prompts are spent either way — clear so the next tap goes
  // manual instead of throwing on a dead event.
  clearInline();
  return outcome;
}

export { isStandalone, isIos };

// Early capture, attached at bundle-eval time (module scope): Chrome fires
// beforeinstallprompt ONCE per page load, possibly before React hydrates.
// A listener added in useEffect can miss it forever, leaving every install
// button dead. Capturing here closes that race; components subscribe below.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(capturedPrompt));
  });
  window.addEventListener("appinstalled", () => {
    capturedPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed || isStandalone()) return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    // Prompt itself is captured at module scope (see above) so slow
    // hydration can never miss it — subscribe and reflect current state.
    return onInstallPromptAvailable((p) => {
      setDeferred(p);
      setVisible(!!p);
    });
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    else setDeferred(null);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:bottom-6 sm:right-6 lg:bottom-6">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-[var(--bg-elevated)] px-4 py-3 shadow-lg sm:mx-0">
        {/* Real brand mark (black tile + white angular S) */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1 text-[13px] leading-tight">
          <p className="font-bold text-ink">Install Snívať</p>
          <p className="truncate text-ink-muted">
            {iosHint ? "Share menu → Add to Home Screen" : "Add to your home screen"}
          </p>
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1.5 text-ink-muted hover:bg-soft"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

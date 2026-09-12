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

/** In-app browsers (WhatsApp, Instagram, Facebook, TikTok, …) render pages
 *  in a crippled WebView: no install prompt can EVER fire there, and most
 *  have no "install" menu either. The only fix is leaving for a real
 *  browser — detect it so surfaces can offer the escape hatch instead of
 *  a dead button. */
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = window.navigator.userAgent || "";
  // App markers first (some embed full Chrome UAs alongside these).
  if (/WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Twitter|LinkedIn|Snapchat|TikTok|Pinterest|Line\/|Viber|Telegram/i.test(ua)) {
    return true;
  }
  // Generic Android WebView (Chrome without the browser chrome): version
  // token + `wv` marker, and no `Chrome/... Safari` full-browser tail…
  // in practice `; wv)` is the reliable signal.
  if (/; wv\)/i.test(ua)) return true;
  return false;
}

/** Android intent URL that breaks out of a WebView into real Chrome,
 *  preserving path + query (including ?ref= attribution). No-op shape on
 *  desktop — callers only render this for in-app Android. */
export function openInChromeUrl(): string {
  const host = "snivat.vercel.app";
  const path =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/auth/signin?mode=create";
  const https = `https://${host}${path}`;
  return (
    `intent://${host}${path}` +
    `#Intent;scheme=https;package=com.android.chrome` +
    `;S.browser_fallback_url=${encodeURIComponent(https)};end`
  );
}

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
  const [manual, setManual] = useState(false);

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
    // In-app WebView: no prompt will ever exist — say so instead of dying.
    try {
      if (isInAppBrowser()) {
        setManual(true);
        return;
      }
    } catch {}
    if (!deferred) {
      const outcome = await promptInstall();
      if (outcome === null) setManual(true);
      else if (outcome === "accepted") dismiss();
      return;
    }
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
            {iosHint
              ? "Share menu → Add to Home Screen"
              : manual
                ? "Browser menu → Install app"
                : "Add to your home screen"}
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

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

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
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
        <span
          aria-hidden
          className="h-9 w-9 shrink-0 rounded-full"
          style={{ background: "#2f9e6b" }}
        />
        <div className="min-w-0 flex-1 text-[13px] leading-tight">
          <p className="font-bold text-ink">Install Snívať</p>
          <p className="truncate text-muted-ink" style={{ color: "var(--ink-muted)" }}>
            {iosHint ? "Share menu → Add to Home Screen" : "Add to your home screen"}
          </p>
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-bold text-white transition-colors"
            style={{ background: "#2f9e6b" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#34b577")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2f9e6b")}
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1.5 hover:bg-soft"
          style={{ color: "var(--ink-muted)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

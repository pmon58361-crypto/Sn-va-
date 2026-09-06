"use client";

import { useEffect, useState } from "react";

// Push toggle: subscribes this browser via the service worker + VAPID key.
// One row per device server-side; disabling removes only this browser.
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle() {
  const [state, setState] = useState<"loading" | "on" | "off" | "blocked" | "unsupported">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("blocked");
        return;
      }
      const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
      const { publicKey } = (await keyRes.json()) as { publicKey: string | null };
      if (!publicKey) throw new Error("Push not configured yet");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Subscribe failed");
      setState("on");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;

  const description =
    state === "blocked"
      ? "Blocked — allow notifications in your browser settings first."
      : state === "on"
        ? "This browser gets notified about DMs and replies."
        : "Get notified about DMs and replies on this browser.";

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-ink">Push notifications</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
      {state === "loading" ? (
        <span className="text-xs text-ink-faint">Checking…</span>
      ) : (
        <button
          type="button"
          disabled={busy || state === "blocked"}
          onClick={() => (state === "on" ? disable() : enable())}
          className={state === "on" ? "btn-outline px-4 py-1.5 text-sm" : "btn-primary px-4 py-1.5 text-sm"}
        >
          {busy ? "Working…" : state === "on" ? "Disable" : "Enable"}
        </button>
      )}
    </div>
  );
}

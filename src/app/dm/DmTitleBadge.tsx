"use client";

import { useEffect } from "react";

// Reflects total unread DMs in the browser tab title: "(2) DMs — Snívať".
// Server components can't touch document.title after hydration, so this
// tiny client shim owns the tab while /dm is open and restores on unmount.
export function DmTitleBadge({ unread }: { unread: number }) {
  useEffect(() => {
    const base = "DMs — Snívať";
    const prev = document.title;
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
    return () => {
      document.title = prev;
    };
  }, [unread]);
  return null;
}

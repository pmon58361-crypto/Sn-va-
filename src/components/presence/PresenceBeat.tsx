"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// 60s presence heartbeat while the tab is visible. Sends only the app AREA
// (never precise URLs) and goes fully silent when the user opts out via
// localStorage ("presence-optout"), hides the tab, or isn't signed in.
const AREA_RULES: [RegExp, string][] = [
  [/^\/community\/[^/]+/, "Reading a post"],
  [/^\/community/, "Community"],
  [/^\/jobs/, "Jobs"],
  [/^\/applications/, "Applications"],
  [/^\/dm/, "DMs"],
  [/^\/profile/, "Profiles"],
  [/^\/people/, "Profiles"],
  [/^\/leaderboard/, "Leaderboard"],
  [/^\/settings/, "Settings"],
];

function areaFor(pathname: string): string {
  for (const [re, area] of AREA_RULES) if (re.test(pathname)) return area;
  return "Exploring Snívať";
}

export function PresenceBeat() {
  const pathname = usePathname();

  useEffect(() => {
    let stopped = false;
    let authorized: boolean | null = null;

    const optedOut = () => localStorage.getItem("presence-optout") === "1";

    async function send() {
      if (stopped || optedOut() || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: areaFor(window.location.pathname) }),
          keepalive: true,
        });
        if (res.status === 401) authorized = false;
        else if (res.ok) authorized = true;
        // Transient failures: stay quiet this tick, retry on the next beat.
      } catch {
        /* offline — skip */
      }
    }

    void send();
    const iv = setInterval(() => {
      // Once we know we're signed out, stop hammering the endpoint.
      if (authorized === false) return;
      void send();
    }, 60_000);
    document.addEventListener("visibilitychange", send);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", send);
    };
  }, [pathname]);

  return null;
}

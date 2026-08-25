"use client";

import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const DEFAULT_ACCENT = "#e8a33d";

// Applies the user's saved theme + accent color to <html>.
// Dark is the DEFAULT (:root is dark). We only add the "light" class
// to opt INTO light mode. Theme precedence:
//   session pref > localStorage > system pref > dark (default)
function ThemeApplier() {
  const { data: session } = useSession();

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const theme = session?.user?.theme || stored;
    // Light only if explicitly chosen, OR (no pref AND system says light)
    const wantsLight =
      theme === "light" ||
      (!theme && !systemPrefersDark());
    document.documentElement.classList.toggle("light", wantsLight);
  }, [session?.user?.theme]);

  useEffect(() => {
    const storedBg = localStorage.getItem("background");
    const bg = session?.user?.background || storedBg || null;
    applyBackground(bg);
  }, [session?.user?.background]);

  useEffect(() => {
    const storedAccent = localStorage.getItem("accent");
    const accent = session?.user?.accent || storedAccent || DEFAULT_ACCENT;
    applyAccent(accent);
  }, [session?.user?.accent]);

  return null;
}

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

// Apply a custom background: sets --bg plus derived elevated/soft surfaces.
export function applyBackground(hex: string | null) {
  const root = document.documentElement.style;
  if (!hex) {
    root.removeProperty("--user-bg");
    root.removeProperty("--bg");
    root.removeProperty("--bg-rgb");
    root.removeProperty("--bg-elevated");
    root.removeProperty("--bg-elevated-rgb");
    root.removeProperty("--bg-soft");
    root.removeProperty("--bg-soft-rgb");
    return;
  }
  const dark = !document.documentElement.classList.contains("light");
  root.setProperty("--user-bg", hex);
  root.setProperty("--bg", hex);
  root.setProperty("--bg-rgb", toChannels(hex));
  const elevated = shade(hex, dark ? 10 : 6);
  const soft = shade(hex, dark ? -35 : -5);
  root.setProperty("--bg-elevated", elevated);
  root.setProperty("--bg-elevated-rgb", toChannels(elevated));
  root.setProperty("--bg-soft", soft);
  root.setProperty("--bg-soft-rgb", toChannels(soft));
}

// Apply the accent and derive its tint/hover shades so a single hex drives
// the whole accent system without requiring a full palette per color.
export function applyAccent(hex: string) {
  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", toChannels(hex));
  root.setProperty("--accent-hover", shade(hex, -18));
  root.setProperty("--accent-soft", shade(hex, 22));
  root.setProperty("--accent-tint", tint(hex, 0.9));
}

// Lighten/darken a hex by a percentage (-100..100). Negative = darker.
function shade(hex: string, percent: number): string {
  const { r, g, b } = parseHex(hex);
  const f = percent / 100;
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  const mix = (c: number) => Math.round((t - c) * p + c);
  return toHex(mix(r), mix(g), mix(b));
}

// Blend toward the page background by `amount` (0..1). Used for soft tints.
function tint(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const bg = 246; // approx --bg cream
  const mix = (c: number) => Math.round(c * (1 - amount) + bg * amount);
  return toHex(mix(r), mix(g), mix(b));
}

function parseHex(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// "47 158 107" — the channel form Tailwind alpha modifiers read from.
function toChannels(hex: string): string {
  const { r, g, b } = parseHex(hex);
  return `${r} ${g} ${b}`;
}

function toHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeApplier />
      {children}
    </SessionProvider>
  );
}



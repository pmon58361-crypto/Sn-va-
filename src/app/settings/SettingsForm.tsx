"use client";

import { useState, useEffect, useTransition } from "react";
import { saveSettings, type SettingsInput } from "./actions";
import { applyAccent, applyBackground } from "@/components/ThemeProvider";
import { SunIcon, MoonIcon, CheckIcon } from "@/components/ui/Icons";

// First entry is the brand default (luminous green). Users may pick any.
const BG_PRESETS = [
  "#121212", // true black
  "#15202b", // midnight blue
  "#1a1a2e", // deep violet night
  "#0d1f1a", // forest floor
  "#2b1d17", // espresso
  "#f6f3ee", // warm cream (light)
];

const ACCENTS = [
  "#2f9e6b", // brand green
  "#0891b2", // cyan
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#dc2626", // red
  "#ea580c", // orange
  "#d97706", // amber
];

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [location, setLocation] = useState(initial.location);
  const [image, setImage] = useState(initial.image);
  const [theme, setTheme] = useState(initial.theme);
  const [accent, setAccent] = useState(initial.accent);
  const [background, setBackground] = useState(initial.background ?? "");
  const [emailNotifications, setEmailNotifications] = useState(initial.emailNotifications);
  const [publicProfile, setPublicProfile] = useState(initial.publicProfile);
  const [showEmail, setShowEmail] = useState(initial.showEmail);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Live preview: theme + accent apply immediately and persist to localStorage.
  // Dark is default (:root). Light is opt-in via the .light class.
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem("accent", accent);
  }, [accent]);

  useEffect(() => {
    applyBackground(background || null);
    if (background) localStorage.setItem("background", background);
    else localStorage.removeItem("background");
  }, [background]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [savedFlash]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveSettings({
          name, bio, location, image, theme, accent, background,
          emailNotifications, publicProfile, showEmail,
        });
        setSavedFlash(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {error && (
        <div className="rounded-xl border border-warm bg-warm-tint px-4 py-3 text-sm text-warm">
          {error}
        </div>
      )}

      {/* Profile */}
      <section>
        <SectionTitle>Profile</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Avatar URL" className="sm:col-span-2">
            <input className="input" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Bio" className="sm:col-span-2">
            <textarea className="input min-h-[100px] resize-y" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Tell people about yourself…" />
          </Field>
        </div>
      </section>

      {/* Appearance */}
      <section>
        <SectionTitle>Appearance</SectionTitle>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-soft">Theme</p>
            <div className="flex gap-2">
              <ThemeButton active={theme === "light"} onClick={() => setTheme("light")}>
                <SunIcon className="h-4 w-4" /> Light
              </ThemeButton>
              <ThemeButton active={theme === "dark"} onClick={() => setTheme("dark")}>
                <MoonIcon className="h-4 w-4" /> Dark
              </ThemeButton>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-soft">Accent color</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  className={`grid h-8 w-8 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-[var(--bg)] transition ${
                    accent.toLowerCase() === c.toLowerCase()
                      ? "ring-ink-faint"
                      : "ring-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`accent ${c}`}
                >
                  {accent.toLowerCase() === c.toLowerCase() && (
                    <CheckIcon className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
              <label className="ml-2 flex items-center gap-2 text-sm text-ink-muted">
                Custom
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-soft">Background color</p>
            <p className="mb-3 text-xs text-ink-faint">
              Tints the whole app. Leave empty for the theme default.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {BG_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBackground(c)}
                  className={`h-8 w-8 rounded-full border border-line-strong ring-2 ring-offset-2 ring-offset-[var(--bg)] transition ${
                    background.toLowerCase() === c.toLowerCase()
                      ? "ring-accent"
                      : "ring-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`background ${c}`}
                />
              ))}
              <label className="ml-2 flex items-center gap-2 text-sm text-ink-muted">
                Custom
                <input
                  type="color"
                  value={background || "#121212"}
                  onChange={(e) => setBackground(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </label>
              {background && (
                <button
                  type="button"
                  onClick={() => setBackground("")}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & notifications */}
      <section>
        <SectionTitle>Privacy &amp; Notifications</SectionTitle>
        <div className="space-y-3">
          <Toggle
            label="Public profile"
            description="Let other users view your profile page."
            checked={publicProfile}
            onChange={setPublicProfile}
          />
          <Toggle
            label="Show email on profile"
            description="Display your email address publicly."
            checked={showEmail}
            onChange={setShowEmail}
          />
          <Toggle
            label="Email notifications"
            description="Get notified about new comments and applications."
            checked={emailNotifications}
            onChange={setEmailNotifications}
          />
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-line bg-surface/90 p-3 shadow-lg backdrop-blur">
        {savedFlash && (
          <span className="flex items-center gap-1 text-sm text-accent">
            <CheckIcon className="h-4 w-4" /> Saved
          </span>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-ink">{children}</h2>;
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
        active
          ? "border-accent bg-accent-tint text-accent"
          : "border-line-strong text-ink-muted hover:border-accent hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "" : "bg-line-strong"
        }`}
        style={checked ? { backgroundColor: "var(--accent)" } : undefined}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}



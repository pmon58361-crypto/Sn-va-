"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { signOut } from "next-auth/react";
import { saveSettings, deactivateAccount, type SettingsInput } from "./actions";
import { applyAccent, applyBackground } from "@/components/ThemeProvider";
import { InterestsEditor } from "@/components/onboarding/InterestsEditor";
import {
  SunIcon,
  MoonIcon,
  CheckIcon,
  UserIcon,
  ClipboardIcon,
  SlidersIcon,
  SettingsIcon,
} from "@/components/ui/Icons";

const BG_PRESETS = [
  { c: "#121212", label: "True black" },
  { c: "#15202b", label: "Midnight" },
  { c: "#1a1a2e", label: "Violet night" },
  { c: "#0d1f1a", label: "Forest" },
  { c: "#2b1d17", label: "Espresso" },
];

const ACCENTS = [
  { c: "#2f9e6b", label: "Brand" },
  { c: "#0891b2", label: "Cyan" },
  { c: "#2563eb", label: "Blue" },
  { c: "#7c3aed", label: "Violet" },
  { c: "#db2777", label: "Pink" },
  { c: "#dc2626", label: "Red" },
  { c: "#ea580c", label: "Orange" },
  { c: "#d97706", label: "Amber" },
];

type Tab = "account" | "appearance" | "privacy" | "interests";

const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: SunIcon },
  { id: "interests", label: "Interests", icon: SlidersIcon },
  { id: "privacy", label: "Privacy", icon: ClipboardIcon },
];

function avatarUrlError(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const ok =
    u.startsWith("/") || u.startsWith("data:image/") || /^https?:\/\//i.test(u);
  return ok ? null : "Must be a direct image link starting with https://";
}

export function SettingsForm({
  initial,
  interests = [],
  suggestions = [],
}: {
  initial: SettingsInput;
  interests?: string[];
  suggestions?: string[];
}) {
  const [tab, setTab] = useState<Tab>("account");
  const [form, setForm] = useState<SettingsInput>(initial);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSavedFlash(false);
    setError(null);
  }

  // Debounced avatar preview — avoids flashing every keystroke.
  const [previewUrl, setPreviewUrl] = useState(initial.image);
  useEffect(() => {
    const t = setTimeout(() => setPreviewUrl(form.image.trim()), 400);
    return () => clearTimeout(t);
  }, [form.image]);

  // Avatar upload from device storage -> /api/upload (Cloudinary in prod).
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarFile(file: File) {
    setUploadError(null);
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!okTypes.includes(file.type)) {
      setUploadError("Only JPG, PNG, WebP or GIF allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }
      const data: { urls?: string[]; errors?: string[] } = await res.json();
      if (!data.urls?.length) {
        throw new Error(data.errors?.[0] || "Upload failed");
      }
      // Uploaded URL passes the server's own avatar validation (it IS an image).
      set("image", data.urls[0]);
      setPreviewUrl(data.urls[0]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Appearance applies instantly; persistence happens on Save (unchanged).
  useEffect(() => {
    document.documentElement.classList.toggle("light", form.theme === "light");
    localStorage.setItem("theme", form.theme);
  }, [form.theme]);

  useEffect(() => {
    applyAccent(form.accent);
    localStorage.setItem("accent", form.accent);
  }, [form.accent]);

  useEffect(() => {
    applyBackground(form.background || null);
    if (form.background) localStorage.setItem("background", form.background);
    else localStorage.removeItem("background");
  }, [form.background]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const dirty = useMemo(
    () =>
      JSON.stringify({
        ...form,
        image: form.image.trim(),
      }) !==
      JSON.stringify({ ...initial, image: initial.image.trim() }),
    [form, initial]
  );

  const urlError = avatarUrlError(form.image);
  const canSubmit = !pending && !urlError;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    try {
      await saveSettings({ ...form, image: form.image.trim() });
      setSavedFlash(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  const status = error ? (
    <span className="text-sm font-medium text-warm">{error}</span>
  ) : pending ? (
    <span className="text-sm text-ink-muted">Saving…</span>
  ) : savedFlash && !dirty ? (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
      <CheckIcon className="h-4 w-4" /> Saved
    </span>
  ) : dirty ? (
    <span className="text-sm font-medium text-ink-muted">Unsaved changes</span>
  ) : null;

  return (
    <form onSubmit={onSubmit} className="pb-28">
      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-[15px] transition-colors first:pl-0 ${
                active
                  ? "font-semibold text-ink"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── ACCOUNT ─────────────────────────────────────────────── */}
      {tab === "account" && (
        <section role="tabpanel" aria-label="Account">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Display name">
              <input
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={60}
                placeholder="Your name"
              />
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                maxLength={60}
                placeholder="City, country"
              />
            </Field>
          </div>

          <Field label="Avatar" className="mt-5">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={previewUrl}
                src={previewUrl || `https://placehold.co/80x80/2a2a2e/777?text=%20`}
                alt=""
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.25")}
                onLoad={(e) => ((e.target as HTMLImageElement).style.opacity = "1")}
                className="h-14 w-14 shrink-0 rounded-2xl border border-line object-cover transition-opacity"
              />
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <input
                    className={`input flex-1 ${urlError ? "!border-warm" : ""}`}
                    value={form.image}
                    onChange={(e) => set("image", e.target.value)}
                    placeholder="https://…jpg/png/webp"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileRef.current?.click()}
                    disabled={uploading}
                    className="btn-outline shrink-0 px-4 py-2 text-sm"
                    title="Upload an image from your device"
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <p
                  className={`mt-1 text-xs ${
                    urlError || uploadError ? "text-warm" : "text-ink-faint"
                  }`}
                >
                  {urlError ??
                    uploadError ??
                    "Upload from your device or paste a direct image link."}
                </p>
              </div>
            </div>
          </Field>

          <Field label="Bio" className="mt-5">
            <textarea
              className="input min-h-[100px] resize-y"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              maxLength={500}
              placeholder="Tell people about yourself…"
            />
            <p
              className={`mt-1 text-right text-xs tabular-nums ${
                form.bio.length >= 450 ? "text-warm" : "text-ink-faint"
              }`}
            >
              {form.bio.length}/500
            </p>
          </Field>

          <DangerZone />
        </section>
      )}

      {/* ── APPEARANCE ──────────────────────────────────────────── */}
      {tab === "appearance" && (
        <section role="tabpanel" aria-label="Appearance">
          <GroupTitle icon={<SettingsIcon className="h-3.5 w-3.5" />}>Theme</GroupTitle>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <ThemePreviewCard
              label="Light"
              active={form.theme === "light"}
              onClick={() => set("theme", "light")}
              mockBg="#f4f2ee"
              panelBg="#ffffff"
              lineColor="#d8d4cd"
              textColor="#3b3b3b"
              Icon={SunIcon}
            />
            <ThemePreviewCard
              label="Dark"
              active={form.theme === "dark"}
              onClick={() => set("theme", "dark")}
              mockBg="#121216"
              panelBg="#1c1c22"
              lineColor="#2c2c34"
              textColor="#d8d8de"
              Icon={MoonIcon}
            />
          </div>

          <GroupTitle icon={<SunIcon className="h-3.5 w-3.5" />}>Accent</GroupTitle>
          <p className="-mt-3 mb-3 text-xs text-ink-faint">
            Tints buttons, links &amp; highlights everywhere.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENTS.map(({ c, label }) => {
              const active = form.accent.toLowerCase() === c.toLowerCase();
              return (
                <AccentDot
                  key={c}
                  color={c}
                  title={label}
                  active={active}
                  onClick={() => set("accent", c)}
                />
              );
            })}
            <span className="mx-1 h-8 w-px bg-line" aria-hidden />
            {/* Custom picker — also the active indicator for saved accents
                that aren't in the preset list. */}
            <label
              className="relative grid h-11 w-11 cursor-pointer place-items-center overflow-hidden rounded-2xl transition-all"
              style={{
                border: `2px dashed ${
                  !ACCENTS.some(
                    (a) => a.c.toLowerCase() === form.accent.toLowerCase()
                  )
                    ? "var(--accent)"
                    : "var(--line-strong)"
                }}`,
                boxShadow: !ACCENTS.some(
                  (a) => a.c.toLowerCase() === form.accent.toLowerCase()
                )
                  ? "0 0 0 2px rgba(var(--accent-rgb), 0.25)"
                  : undefined,
                color: form.accent,
              }}
              title={`Custom color (${form.accent})`}
            >
              {!ACCENTS.some(
                (a) => a.c.toLowerCase() === form.accent.toLowerCase()
              ) ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <span className="text-xs font-bold">+</span>
              )}
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.accent) ? form.accent : "#ffffff"}
                onChange={(e) => set("accent", e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>

          <GroupTitle icon={<SunIcon className="h-3.5 w-3.5" />}>Background tint</GroupTitle>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            <button
              type="button"
              onClick={() => set("background", "")}
              className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
                !form.background
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-line hover:border-line-strong"
              }`}
              aria-label="default background"
            >
              <span
                className="block h-12 w-full"
                style={{ background: "linear-gradient(135deg,#1a1a1f,#101014)" }}
              />
              <span className="block py-1 text-center text-[10px] font-medium text-ink-muted">
                Default
              </span>
            </button>
            {BG_PRESETS.map(({ c, label }) => (
              <button
                key={c}
                type="button"
                onClick={() => set("background", c)}
                aria-label={label}
                className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
                  form.background.toLowerCase() === c.toLowerCase()
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span
                  className="block h-12 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${c}, ${form.accent}30), ${c}`,
                  }}
                />
                <span className="block truncate py-1 text-center text-[10px] font-medium text-ink-muted">
                  {label}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
            <CheckIcon className="h-3.5 w-3.5 text-accent" />
            Previews apply instantly — saved only when you confirm.
          </p>
        </section>
      )}

      {/* ── PRIVACY ─────────────────────────────────────────────── */}
      {tab === "privacy" && (
        <section role="tabpanel" aria-label="Privacy">
          <div className="card divide-y divide-line overflow-hidden">
            <ToggleRow
              label="Public profile"
              description="Let other users view your profile page."
              checked={form.publicProfile}
              onChange={(v) => set("publicProfile", v)}
            />
            <ToggleRow
              label="Show email on profile"
              description="Display your email address publicly."
              checked={form.showEmail}
              onChange={(v) => set("showEmail", v)}
            />
            <ToggleRow
              label="Creator account"
              description="Unlocks your creator dashboard with real stats about your posts."
              checked={form.isCreator}
              onChange={(v) => set("isCreator", v)}
            />
            {form.isCreator && (
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <p className="text-xs text-ink-muted">
                  Dashboard is enabled — find it in the sidebar.
                </p>
                <a href="/dashboard" className="btn-outline shrink-0 px-4 py-1.5 text-sm">
                  Open dashboard
                </a>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-ink">Session</p>
                <p className="text-xs text-ink-muted">
                  Sign out of Snívať on this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-ghost shrink-0 px-4 py-1.5 text-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── INTERESTS ───────────────────────────────────────────── */}
      {tab === "interests" && (
        <InterestsEditor initial={interests} suggestions={suggestions} />
      )}

      {/* ── Save bar ────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[calc(100%-24rem)] xl:w-[calc(100%-32rem)]">
        <div
          className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-line bg-surface/80 p-3 pl-5 backdrop-blur-xl transition-shadow"
          style={{ boxShadow: `0 8px 40px -12px ${form.accent}55` }}
        >
          <span aria-live="polite" className="min-w-0 truncate">
            {status ?? (
              <span className="hidden text-xs text-ink-faint sm:block">
                Changes are saved when you confirm.
              </span>
            )}
          </span>
          <button
            type="submit"
            disabled={!canSubmit || !dirty}
            className="btn-primary shrink-0"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------- pieces ---------- */

function GroupTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-2 first:mt-0">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <h2 className="text-sm font-semibold tracking-wide text-ink">{children}</h2>
    </div>
  );
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function AccentDot({
  color,
  title,
  active,
  onClick,
}: {
  color: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-label={`accent ${title}`}
      aria-pressed={active}
      className="group relative grid h-11 w-11 place-items-center rounded-2xl transition-all duration-150 hover:-translate-y-0.5"
      style={{
        backgroundColor: color,
        boxShadow: active
          ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px var(--accent)`
          : undefined,
      }}
    >
      <span
        className={`absolute inset-0 grid place-items-center rounded-2xl bg-black/25 text-white transition-opacity ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
        }`}
      >
        <CheckIcon className="h-4 w-4" />
      </span>
    </button>
  );
}

function ThemePreviewCard({
  label,
  active,
  onClick,
  mockBg,
  panelBg,
  lineColor,
  textColor,
  Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  mockBg: string;
  panelBg: string;
  lineColor: string;
  textColor: string;
  Icon: typeof SunIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`overflow-hidden rounded-2xl border p-2 text-left transition-colors duration-150 ${
        active
          ? "border-accent ring-2 ring-accent/30"
          : "border-line hover:border-line-strong"
      }`}
    >
      <div
        className="mb-2 flex h-16 gap-1.5 rounded-xl p-1.5"
        style={{ backgroundColor: mockBg }}
        aria-hidden
      >
        <div className="w-1/4 space-y-1 rounded-lg p-1.5" style={{ backgroundColor: panelBg }}>
          {[0.9, 0.6, 0.75].map((w, i) => (
            <div
              key={i}
              className="h-1 rounded-full"
              style={{ width: `${w * 100}%`, backgroundColor: lineColor }}
            />
          ))}
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: textColor, opacity: 0.85 }} />
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: lineColor }} />
          <div className="h-1.5 w-5/6 rounded-full" style={{ backgroundColor: lineColor }} />
          <div className="mt-1.5 h-4 w-10 rounded-md" style={{ backgroundColor: "var(--accent)" }} />
        </div>
      </div>
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        {active && (
          <span
            className="grid h-5 w-5 place-items-center rounded-full text-white"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <CheckIcon className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await deactivateAccount();
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-warm/40 bg-warm/5 p-4">
      <h3 className="text-sm font-bold text-warm">Danger zone</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        Deactivating hides your profile and all your posts immediately and
        signs you out. Nothing is deleted — signing back in restores
        everything exactly as it was.
      </p>
      {error && <p className="mt-2 text-xs text-warm">{error}</p>}
      <div className="mt-3 flex gap-2">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="btn-outline px-4 py-2 text-sm !border-warm !text-warm"
          >
            Deactivate account…
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="btn-outline px-4 py-2 text-sm !border-warm !bg-warm/10 !text-warm"
            >
              {busy ? "Deactivating…" : "Yes, hide my account"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="btn-outline px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors duration-150 hover:bg-[var(--bg-soft)]"
    >
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{description}</span>
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
        style={{
          backgroundColor: checked ? "var(--accent)" : "var(--line-strong)",
        }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all duration-150"
          style={{ left: checked ? 22 : 2 }}
        />
      </span>
    </button>
  );
}

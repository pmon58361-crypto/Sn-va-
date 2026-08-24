"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { createAccount } from "./actions";

type OAuthProvider = { id: string; name: string; mark: React.ReactNode };

const MARKS: Record<string, React.ReactNode> = {
  github: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1877F2">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  ),
  "microsoft-entra-id": (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  ),
};

const NAMES: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  facebook: "Facebook",
  "microsoft-entra-id": "Microsoft",
  yahoo: "Yahoo",
};

// Shared field styling for the email/password forms (terminal aesthetic).
const FIELD =
  "w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60";

export function SignInForm({ oauthProviders }: { oauthProviders: string[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  // "signin" = access code / email+password / OAuth · "create" = registration.
  // Landing CTAs deep-link with ?mode=create (worker F contract).
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "create">(
    searchParams.get("mode") === "create" ? "create" : "signin"
  );

  // Failed credentials attempts land back here with ?error=... after the
  // full-page redirect — surface a real message instead of a bare URL.
  const urlError = useSearchParams().get("error");
  const inheritedError =
    urlError === "CredentialsSignin"
      ? "Invalid access code. Check it and try again."
      : urlError === "Configuration"
      ? "Sign-in hit a snag on our side. Please try again in a moment."
      : null;
  const shownError = error ?? inheritedError;

  async function handleOAuth(provider: string) {
    setError(null);
    setLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/community", redirect: true });
    } catch {
      setError("Sign-in was interrupted. Please try again.");
      setLoading(null);
    }
  }

  async function handleAccessCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const fd = new FormData(e.currentTarget);
    const code = (fd.get("code") as string) || "";
    setError(null);
    setLoading("credentials");
    try {
      await signIn("credentials", { code, callbackUrl: "/community", redirect: true });
    } catch {
      setError("Invalid access code. Check it and try again.");
      setLoading(null);
    }
  }

  // Email + password sign-in for registered accounts (legacy authorize path
  // validates the bcrypt hash stored on the credentials Account row).
  async function handleEmailSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const fd = new FormData(e.currentTarget);
    const email = ((fd.get("email") as string) || "").trim();
    const password = (fd.get("password") as string) || "";
    if (!email || !password) return;
    setError(null);
    setLoading("email");
    try {
      await signIn("credentials", { email, password, callbackUrl: "/community", redirect: true });
      // redirect:true navigates on success; failures land on ?error=
    } catch {
      setError("Wrong email or password. Try again.");
      setLoading(null);
    }
  }

  // Open registration: create the account server-side, then sign straight in
  // with the same credentials so the new user lands in the feed.
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const fd = new FormData(e.currentTarget);
    const name = ((fd.get("name") as string) || "").trim();
    const email = ((fd.get("email") as string) || "").trim();
    const password = (fd.get("password") as string) || "";
    const confirm = (fd.get("confirm") as string) || "";
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading("create");
    try {
      const res = await createAccount({ name, email, password });
      if (!res.ok) {
        setError(res.error || "Couldn't create your account.");
        setLoading(null);
        return;
      }
      await signIn("credentials", { email, password, callbackUrl: "/community", redirect: true });
    } catch {
      setError("Couldn't create your account right now. Please try again.");
      setLoading(null);
    }
  }

  // Instant entry with the public demo account (documented in README).
  // REMOVED: this bypassed the access-code gate. Demo access now requires
  // DEMO_CODE — see handleAccessCode above. Re-add deliberately if a free
  // preview mode is ever wanted.

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "body{background:#0a0a0b!important}" }} />
      <main className="page-flood relative flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] px-5 py-16">
      {/* terminal grid + waves */}
      <div aria-hidden className="term-grid pointer-events-none absolute inset-0 abs-bleed" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 35%, transparent 30%, #0a0a0b 80%)" }}
      />
      <div aria-hidden className="wave-band abs-bleed z-0">
        <svg className="wave-2" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <path d="M0,120 C240,60 480,170 720,105 C960,45 1200,175 1440,115 C1680,55 1920,170 2160,105 C2400,45 2640,175 2880,115 L2880,200 L0,200 Z" fill="rgba(201,162,75,0.15)" />
        </svg>
        <svg className="wave-3" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <path d="M0,70 C240,130 480,25 720,85 C960,140 1200,30 1440,90 C1680,145 1920,35 2160,95 C2400,150 2640,30 2880,80 L2880,200 L0,200 Z" fill="rgba(245,158,11,0.13)" />
        </svg>
        <svg className="wave-1" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <path d="M0,96 C240,160 480,32 720,96 C960,160 1200,32 1440,96 C1680,160 1920,32 2160,96 C2400,160 2640,32 2880,96 L2880,200 L0,200 Z" fill="rgba(251,191,36,0.12)" />
        </svg>
        <svg className="wave-4" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <path d="M0,140 C240,100 480,155 720,125 C960,90 1200,150 1440,135 C1680,95 1920,155 2160,130 C2400,95 2640,150 2880,140 L2880,200 L0,200 Z" fill="rgba(252,211,77,0.10)" />
        </svg>
      </div>

      <div className="reveal relative z-10 w-full max-w-md min-w-0">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={52} />
          <div>
            <p className="font-mono text-xs text-white/40">
              <span className="text-amber-300">$</span> ssh demo@snívať.dev
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {mode === "create" ? "Create your account." : "Welcome back."}
            </h1>
            <p className="mt-1.5 text-sm text-white/50">
              {mode === "create"
                ? "Join Snívať — share what you're building."
                : "Sign in to share what you're building."}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/70 shadow-[0_0_80px_-20px_rgba(245,158,11,0.22)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            </span>
            <span className="font-mono text-xs text-white/40">auth --in</span>
            <span className="w-10" />
          </div>

          <div className="p-6 sm:p-8">
            {shownError && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300"
              >
                // {shownError}
              </div>
            )}

            {/* Mode switch — Sign in / Create account */}
            <div
              className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-1"
              role="tablist"
              aria-label="Account"
            >
              {(["signin", "create"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`rounded-md py-2 text-sm font-semibold transition ${
                    mode === m ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {mode === "signin" && (
              <>
            {/* Demo credentials — always available */}
            <form onSubmit={handleAccessCode} className="space-y-3">
              <input
                name="code"
                type="password"
                required
                autoComplete="off"
                placeholder="access code"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-center font-mono text-sm tracking-[0.35em] text-white placeholder:tracking-normal placeholder:text-white/30 outline-none transition focus:border-amber-400/60"
              />
              <button
                type="submit"
                disabled={loading === "credentials"}
                className="w-full rounded-lg bg-white py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {loading === "credentials" ? "Checking" : "Enter with access code"}
              </button>
              <p className="text-center font-mono text-xs text-white/30">
                // have a code? that is your way in
              </p>
            </form>

                {/* Email + password sign-in for registered accounts */}
                <form onSubmit={handleEmailSignIn} className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={FIELD}
                  />
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="password"
                    autoComplete="current-password"
                    className={FIELD}
                  />
                  <button
                    type="submit"
                    disabled={loading === "email"}
                    className="w-full rounded-lg border border-white/15 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {loading === "email" ? "Checking" : "Sign in with email"}
                  </button>
                  <Link
                    href="/auth/forgot-password"
                    className="text-center font-mono text-xs text-white/40 transition-colors hover:text-white/70"
                  >
                    forgot password?
                  </Link>
                </form>
              </>
            )}

            {mode === "create" && (
              <form onSubmit={handleCreate} className="space-y-3">
                <input
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Your name"
                  autoComplete="name"
                  className={FIELD}
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={FIELD}
                />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={200}
                  placeholder="password (min 8 characters)"
                  autoComplete="new-password"
                  className={FIELD}
                />
                <input
                  name="confirm"
                  type="password"
                  required
                  placeholder="confirm password"
                  autoComplete="new-password"
                  className={FIELD}
                />
                <button
                  type="submit"
                  disabled={loading === "create"}
                  className="w-full rounded-lg bg-amber-400 py-3 text-sm font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {loading === "create" ? "Creating…" : "Create account"}
                </button>
                <p className="text-center font-mono text-xs text-white/30">
                  // 8+ characters · your email stays private
                </p>
              </form>
            )}

            

            {oauthProviders.length > 0 && (
              <>
                <div className="my-6 flex items-center gap-4">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">or</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-3">
                  {oauthProviders.map((id) => (
                    <button
                      key={id}
                      onClick={() => handleOAuth(id)}
                      disabled={!!loading}
                      className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.07] disabled:opacity-50"
                    >
                      {MARKS[id]}
                      {loading === id ? "Connecting…" : `Continue with ${NAMES[id] ?? id}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-xs leading-relaxed text-white/35">
          By continuing you agree to our terms.{" "}
          <Link href="/" className="text-amber-300/90 hover:text-amber-200 hover:underline">
            cd ~/home
          </Link>
        </p>
      </div>

      <div className="mt-6">
        <LegalLinks variant="dark" />
      </div>
    </main>
    </>
  );
}

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { InterestChips } from "@/components/onboarding/InterestChips";
import { createAccount } from "./actions";
import { saveInterests } from "@/app/actions";

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
  yahoo: (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#6001D2] text-[10px] font-black text-white">
      Y!
    </span>
  ),
};

const NAMES: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  facebook: "Facebook",
  "microsoft-entra-id": "Microsoft",
  yahoo: "Yahoo",
};

// Shared field styling for the email/password forms (brand inputs:
// 16px kills the iOS focus-zoom, accent ring on focus).
const FIELD = "input";

export function SignInForm({
  oauthProviders,
  suggestions = [],
}: {
  oauthProviders: string[];
  suggestions?: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  // "signin" = access code / email+password / OAuth · "create" = registration.
  // Landing CTAs deep-link with ?mode=create (worker F contract).
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "create">(
    searchParams.get("mode") === "create" ? "create" : "signin"
  );
  // Stepper signup: 1 name → 2 credentials → 3 interests.
  const [step, setStep] = useState(1);
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suInterests, setSuInterests] = useState<string[]>([]);
  // Shared show/hide for every password field on the card.
  const [showPw, setShowPw] = useState(false);

  function PwToggle() {
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShowPw((v) => !v)}
        aria-label={showPw ? "Hide passwords" : "Show passwords"}
        title={showPw ? "Hide passwords" : "Show passwords"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition hover:text-ink"
      >
        {showPw ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    );
  }

  // Failed credentials attempts land back here with ?error=... after the
  // full-page redirect — surface a real message instead of a bare URL.
  const urlError = searchParams.get("error");
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
  // Stepper step 2 → creates the account, advances to interests.
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (suPass !== suConfirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading("create");
    try {
      const res = await createAccount({ name: suName, email: suEmail, password: suPass });
      if (!res.ok) {
        setError(res.error || "Couldn't create your account.");
        setLoading(null);
        return;
      }
      // Keep suPass in memory — step 3 signs straight in with it.
      setStep(3);
    } catch {
      setError("Couldn't create your account right now. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  // Stepper step 3 → persist picks, then sign straight in with the
  // credentials held in memory from step 2.
  async function finishSignup() {
    if (loading) return;
    setError(null);
    setLoading("finish");
    try {
      await saveInterests(suInterests);
      const email = suEmail;
      const password = suPass;
      // Drop secrets from memory before navigating away.
      setSuPass("");
      setSuConfirm("");
      await signIn("credentials", { email, password, callbackUrl: "/community", redirect: true });
    } catch {
      setError("Almost there — sign in manually to finish.");
      setLoading(null);
    }
  }

  // Instant entry with the public demo account (documented in README).
  // REMOVED: this bypassed the access-code gate. Demo access now requires
  // DEMO_CODE — see handleAccessCode above. Re-add deliberately if a free
  // preview mode is ever wanted.

  return (
    <>
      <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16">
        <div className="reveal relative z-10 w-full max-w-md min-w-0">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Logo size={52} />
            <div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
                {mode === "create" ? "Create your account." : "Welcome back."}
              </h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                {mode === "create"
                  ? "Join Snívať — share what you're building."
                  : "Sign in to share what you're building."}
              </p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            {shownError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-warm/40 bg-warm-tint px-4 py-3 text-sm text-warm"
              >
                {shownError}
              </div>
            )}

            {/* Mode switch — Sign in / Create account */}
            <div
              className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-soft p-1"
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
                  className={`rounded-lg py-2 text-sm font-semibold transition touch-manipulation ${
                    mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
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
                className="input text-center"
              />
              <button
                type="submit"
                disabled={loading === "credentials"}
                className="btn-primary w-full py-3 text-sm disabled:opacity-50"
              >
                {loading === "credentials" ? "Checking" : "Enter with access code"}
              </button>
              <p className="text-center text-xs text-ink-faint">
                Have a code? That is your way in.
              </p>
            </form>

                {/* Email + password sign-in for registered accounts */}
                <form onSubmit={handleEmailSignIn} className="mt-5 space-y-3 border-t border-line pt-5">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={FIELD}
                  />
                  <div className="relative">
                    <input
                      name="password"
                      type={showPw ? "text" : "password"}
                      required
                      placeholder="password"
                      autoComplete="current-password"
                      className={`${FIELD} pr-11`}
                    />
                    <PwToggle />
                  </div>
                  <button
                    type="submit"
                    disabled={loading === "email"}
                    className="btn-outline w-full py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {loading === "email" ? "Checking" : "Sign in with email"}
                  </button>
                  <Link
                    href="/auth/forgot-password"
                    className="block text-center text-xs text-ink-muted transition-colors hover:text-accent"
                  >
                    forgot password?
                  </Link>
                </form>
              </>
            )}

            {mode === "create" && (
              <div>
                {/* Stepper progress */}
                <div className="mb-5 flex items-center gap-2" aria-hidden>
                  {[1, 2, 3].map((s) => (
                    <span
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        step >= s ? "bg-accent" : "bg-soft"
                      }`}
                    />
                  ))}
                  <span className="text-[11px] tabular-nums text-ink-faint">
                    {step}/3
                  </span>
                </div>

                {step === 1 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!suName.trim()) {
                        setError("Please tell us your name.");
                        return;
                      }
                      setError(null);
                      setStep(2);
                    }}
                    className="space-y-3"
                  >
                    <input
                      value={suName}
                      onChange={(e) => setSuName(e.target.value)}
                      required
                      maxLength={60}
                      placeholder="Your name"
                      autoComplete="name"
                      autoFocus
                      className={FIELD}
                    />
                    <button
                      type="submit"
                      disabled={!suName.trim()}
                      className="btn-primary w-full py-3 text-sm disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </form>
                )}

                {step === 2 && (
                  <form onSubmit={handleCreate} className="space-y-3">
                    <input
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      type="email"
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      className={FIELD}
                    />
                    <div className="relative">
                      <input
                        value={suPass}
                        onChange={(e) => setSuPass(e.target.value)}
                        type={showPw ? "text" : "password"}
                        required
                        minLength={8}
                        maxLength={200}
                        placeholder="password (min 8 characters)"
                        autoComplete="new-password"
                        className={`${FIELD} pr-11`}
                      />
                      <PwToggle />
                    </div>
                    <div className="relative">
                      <input
                        value={suConfirm}
                        onChange={(e) => setSuConfirm(e.target.value)}
                        type={showPw ? "text" : "password"}
                        required
                        placeholder="confirm password"
                        autoComplete="new-password"
                        className={`${FIELD} pr-11`}
                      />
                      <PwToggle />
                    </div>
                    <button
                      type="submit"
                      disabled={loading === "create"}
                      className="btn-primary w-full py-3 text-sm disabled:opacity-50"
                    >
                      {loading === "create" ? "Creating…" : "Create account"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep(1); setError(null); }}
                      className="w-full text-center text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      ← back
                    </button>
                    <p className="text-center text-xs text-ink-faint">
                      Your email stays private.
                    </p>
                  </form>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink-muted">
                      Account created — last step:
                    </p>
                    <div className="max-h-[34vh] overflow-y-auto pr-1">
                      <InterestChips
                        suggestions={suggestions}
                        selected={suInterests}
                        onToggle={(tag) =>
                          setSuInterests((s) =>
                            s.includes(tag)
                              ? s.filter((t) => t !== tag)
                              : [...s, tag]
                          )
                        }
                      />
                    </div>
                    {suInterests.length > 0 && suInterests.length < 3 && (
                      <p className="text-xs text-ink-faint">
                        Pick 3 for a sharper feed.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={finishSignup}
                      disabled={loading === "finish"}
                      className="btn-primary w-full py-3 text-sm disabled:opacity-50"
                    >
                      {loading === "finish"
                        ? "Tuning…"
                        : suInterests.length
                        ? `Tune my feed (${suInterests.length})`
                        : "Take me in"}
                    </button>
                    <button
                      type="button"
                      onClick={finishSignup}
                      disabled={loading === "finish"}
                      className="w-full text-center text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      skip interests
                    </button>
                  </div>
                )}
              </div>
            )}

            

            {oauthProviders.length > 0 && (
              <>
                <div className="my-6 flex items-center gap-4">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <div className="space-y-3">
                  {oauthProviders.map((id) => (
                    <button
                      key={id}
                      onClick={() => handleOAuth(id)}
                      disabled={!!loading}
                      className="flex w-full touch-manipulation items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium text-ink-soft transition hover:border-line-strong hover:text-ink disabled:opacity-50"
                    >
                      {MARKS[id]}
                      {loading === id ? "Connecting…" : `Continue with ${NAMES[id] ?? id}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
          By continuing you agree to our terms.{" "}
          <Link href="/terms" className="text-accent hover:underline">
            read them
          </Link>
        </p>
      </div>

      <div className="mt-6">
        <LegalLinks />
      </div>
    </main>
    </>
  );
}

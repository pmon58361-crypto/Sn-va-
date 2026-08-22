"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

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

export function SignInForm({ oauthProviders }: { oauthProviders: string[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

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

  async function handleDemo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string) || "";
    const password = (fd.get("password") as string) || "";
    setError(null);
    setLoading("credentials");
    try {
      await signIn("credentials", { email, password, callbackUrl: "/community", redirect: true });
    } catch {
      setError("Wrong email or password.");
      setLoading(null);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-16">
      {/* Raycast-style animated aurora field */}
      <div aria-hidden className="aurora">
        <span className="aurora-blob aurora-a" />
        <span className="aurora-blob aurora-b" />
        <span className="aurora-streaks" />
      </div>

      <div className="reveal relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={52} />
          <div>
            <h1 className="display-serif text-3xl">
              Welcome <em>back.</em>
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Sign in to share what you're building.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Demo credentials — always available */}
          <form onSubmit={handleDemo} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              defaultValue="demo@snivat.local"
              placeholder="Email"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#c9a24b]/60"
            />
            <input
              name="password"
              type="password"
              required
              defaultValue="demo1234"
              placeholder="Password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#c9a24b]/60"
            />
            <button
              type="submit"
              disabled={loading === "credentials"}
              className="w-full rounded-xl bg-[#c9a24b] py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {loading === "credentials" ? "Signing in…" : "Continue as Demo User"}
            </button>
          </form>

          {oauthProviders.length > 0 && (
            <>
              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/35">or</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-3">
                {oauthProviders.map((id) => (
                  <button
                    key={id}
                    onClick={() => handleOAuth(id)}
                    disabled={!!loading}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.07] disabled:opacity-50"
                  >
                    {MARKS[id]}
                    {loading === id ? "Connecting…" : `Continue with ${NAMES[id] ?? id}`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
          By continuing you agree to our terms.{" "}
          <Link href="/" className="text-[#c9a24b] hover:underline">
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}

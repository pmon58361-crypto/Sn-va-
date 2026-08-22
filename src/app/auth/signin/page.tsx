"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/ui/Logo";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth =
    (provider: string) => async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(provider);
      try {
        // Redirect to the community feed after a successful OAuth sign-in.
        await signIn(provider, { callbackUrl: "/community", redirect: true });
      } catch {
        setError("Sign-in was interrupted. Please try again.");
        setLoading(null);
      }
    };

  const providers = [
    {
      id: "github",
      name: "GitHub",
      mark: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
        </svg>
      ),
    },
    {
      id: "google",
      name: "Google",
      mark: (
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      ),
    },
    {
      id: "facebook",
      name: "Facebook",
      mark: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1877F2">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
      ),
    },
    {
      id: "microsoft-entra-id",
      name: "Microsoft",
      mark: (
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <rect x="2" y="2" width="9" height="9" fill="#F25022" />
          <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
          <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
          <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-5 py-16">
      {/* Animated pocket-watch splash — no text, responsive */}
      <div className="splash-clock mb-10 select-none" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clock.jpg" alt="" className="clock-swing rounded-full shadow-2xl" />
      </div>

      <div className="card w-full p-8 reveal" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="mb-7 flex justify-center">
          <Logo size={46} />
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-line-strong bg-warm-tint px-4 py-3 text-sm text-warm">
            {error}
          </div>
        )}

        {/* OAuth providers */}
        <div className="space-y-3">
          {providers.map((p) => (
            <form key={p.id} onSubmit={handleOAuth(p.id)}>
              <button
                type="submit"
                disabled={loading === p.id}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface px-5 py-3 text-sm font-medium text-ink transition-all duration-300 hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {p.mark}
                {loading === p.id ? "Connecting…" : `Continue with ${p.name}`}
              </button>
            </form>
          ))}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
          By continuing you agree to our terms.{" "}
          <Link href="/" className="text-accent hover:underline">
            Back home
          </Link>
        </p>
      </div>
    </div>
  );
}

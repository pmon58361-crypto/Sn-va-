"use client";

import { useState } from "react";
import { requestPasswordReset } from "../reset-actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await requestPasswordReset(email);
      if (res.ok) setSent(true);
      else setError(res.error || "Something went wrong. Try again.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <p
          role="status"
          className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 font-mono text-sm text-emerald-300"
        >
          ✓ If that email is registered, a reset link is on its way.
        </p>
        <p className="mt-4 font-mono text-xs text-white/40">
          // check your inbox · link expires in 10 minutes
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300"
        >
          // {error}
        </div>
      )}
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-400 py-3 text-sm font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

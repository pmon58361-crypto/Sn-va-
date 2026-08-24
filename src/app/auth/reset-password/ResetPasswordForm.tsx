"use client";

import { useState } from "react";
import Link from "next/link";
import { performPasswordReset } from "../reset-actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await performPasswordReset({ token, password });
      if (res.ok) setDone(true);
      else setError(res.error || "Couldn't reset your password.");
    } catch {
      setError("Couldn't reset your password right now. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p
          role="status"
          className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 font-mono text-sm text-emerald-300"
        >
          ✓ Password updated.
        </p>
        <Link
          href="/auth/signin"
          className="mt-5 inline-block w-full rounded-lg bg-white py-3 text-sm font-bold text-black transition hover:bg-white/90"
        >
          Sign in with your new password
        </Link>
        <p className="mt-3 font-mono text-xs text-white/40">
          // for security, sign in fresh everywhere
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
        name="password"
        type="password"
        required
        minLength={8}
        maxLength={200}
        placeholder="new password (min 8 characters)"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60"
      />
      <input
        name="confirm"
        type="password"
        required
        placeholder="confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-400 py-3 text-sm font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { applyToJob } from "@/app/actions";

// Shows either the apply form or the user's existing application state.
export function ApplyForm({
  postId,
  hasApplied,
  isOwner,
}: {
  postId: string;
  hasApplied: boolean;
  isOwner: boolean;
}) {
  const { status } = useSession();
  const [submitted, setSubmitted] = useState(hasApplied);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plain async submit — useActionState is React 19-only (undefined in
  // this app's React 18.3.1, which crashed the form on render).
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const message = new FormData(e.currentTarget).get("message") as string || "";
    setPending(true);
    setError(null);
    try {
      await applyToJob(postId, message);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setPending(false);
    }
  }

  if (isOwner) {
    return (
      <div className="card p-4 text-sm text-ink-muted">
        This is your listing. You can review applicants below.
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="card flex items-center justify-between gap-4 p-4">
        <p className="text-sm text-ink-muted">Sign in to apply for this job.</p>
        <Link href="/auth/signin" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="card border-warm text-warm bg-warm-tint p-4 text-sm">
        ✓ You&apos;ve applied to this job. The poster will be in touch.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-4">
      <label className="mb-1.5 block text-sm font-medium text-ink-soft">
        Your message
      </label>
      <textarea
        name="message"
        required
        maxLength={2000}
        className="input min-h-[100px] resize-y"
        placeholder="Introduce yourself and explain why you're a good fit…"
      />
      {error && <p className="mt-1 text-xs text-warm">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Sending…" : "Apply now"}
        </button>
      </div>
    </form>
  );
}

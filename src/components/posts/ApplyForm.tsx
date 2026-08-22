"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { applyToJob } from "@/app/actions";

// Shows either the apply form or the user's existing application state,
// including the listing owner's accept/reject decision.
export function ApplyForm({
  postId,
  hasApplied,
  myStatus,
  isOwner,
}: {
  postId: string;
  hasApplied: boolean;
  myStatus?: string;
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

  if (submitted && myStatus === "accepted") {
    return (
      <div
        className="card p-4 text-sm"
        style={{ backgroundColor: "var(--accent-tint)" }}
      >
        <p className="font-semibold text-accent">
          Your application was accepted.
        </p>
        <p className="mt-1 text-ink-muted">
          The poster will reach out to you from here.
        </p>
      </div>
    );
  }

  if (submitted && myStatus === "rejected") {
    return (
      <div className="card p-4 text-sm">
        <p className="font-semibold text-ink-muted">
          Your application wasn&apos;t accepted this time.
        </p>
        <p className="mt-1 text-ink-faint">
          Keep going — more openings land here all the time.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-3">
        <div className="card p-4 text-sm">
          <p className="font-semibold text-ink">Application sent.</p>
          <p className="mt-1 text-ink-muted">
            Still pending — the poster hasn&apos;t responded yet. You can
            update your message below.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card p-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Update your message
          </label>
          <textarea
            name="message"
            required
            maxLength={2000}
            className="input min-h-[100px] resize-y"
            placeholder="Refine your pitch…"
          />
          {error && <p className="mt-1 text-xs text-warm">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={pending} className="btn-outline px-4 py-1.5 text-xs">
              {pending ? "Saving…" : "Update application"}
            </button>
          </div>
        </form>
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

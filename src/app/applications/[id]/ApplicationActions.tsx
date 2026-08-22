"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setApplicationStatus } from "@/app/actions";

// Owner-side decision buttons on an applicant card. Optimistic-free:
// we wait for the server action then refresh to show the badge.
export function ApplicationActions({ applicationId }: { applicationId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function decide(status: "accepted" | "rejected") {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await setApplicationStatus(applicationId, status);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => decide("accepted")}
        disabled={pending}
        className="btn-primary px-4 py-1.5 text-xs"
      >
        Accept
      </button>
      <button
        onClick={() => decide("rejected")}
        disabled={pending}
        className="btn-ghost px-4 py-1.5 text-xs text-warm"
      >
        Reject
      </button>
      {pending && <span className="text-xs text-ink-faint">Saving…</span>}
      {error && <span className="text-xs text-warm">{error}</span>}
    </div>
  );
}

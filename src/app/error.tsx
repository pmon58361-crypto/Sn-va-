"use client";

import Link from "next/link";
import { useEffect } from "react";

// Root error boundary. Catches any uncaught server/client error below the
// root layout and replaces Next's default crash screen with something that
// matches the app's visual language and offers real actions.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md px-6 py-12 text-center">
        <h1 className="text-xl font-bold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          The page hit an unexpected error. Retrying usually fixes it — if it
          keeps happening, it is on us, not you.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-faint">
            ref: {error.digest}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { addComment } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";

export function CommentComposer({ postId }: { postId: string }) {
  const { data: session, status } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plain async submit — useActionState is React 19-only (undefined in
  // this app's React 18.3.1, which crashed the composer on render).
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const content = (new FormData(form).get("content") as string) || "";
    setPending(true);
    setError(null);
    try {
      await addComment(postId, content);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPending(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <div className="card flex items-center justify-between gap-4 p-4">
        <p className="text-sm text-ink-muted">
          Sign in to join the discussion.
        </p>
        <Link href="/auth/signin" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card flex gap-3 p-4">
      <Avatar
        name={session.user.name}
        image={session.user.image}
        size={36}
      />
      <div className="flex-1">
        <textarea
          name="content"
          required
          maxLength={2000}
          className="input min-h-[72px] resize-y"
          placeholder="Write a comment…"
        />
        {error && (
          <p className="mt-1 text-xs text-warm">{error}</p>
        )}
        <div className="mt-2 flex justify-end">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Posting…" : "Post comment"}
          </button>
        </div>
      </div>
    </form>
  );
}

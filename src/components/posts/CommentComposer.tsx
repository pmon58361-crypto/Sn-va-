"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { addComment } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";

export function CommentComposer({ postId }: { postId: string }) {
  const { data: session, status } = useSession();
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const content = formData.get("content") as string;
      try {
        await addComment(postId, content);
        formRef.current?.reset();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Failed to post comment";
      }
    },
    null
  );

  // Clear error after a few seconds
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => {}, 3000);
    return () => clearTimeout(t);
  }, [state]);

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
    <form ref={formRef} action={formAction} className="card flex gap-3 p-4">
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
        {state && (
          <p className="mt-1 text-xs text-accent">{String(state)}</p>
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

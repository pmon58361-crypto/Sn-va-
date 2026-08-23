"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitPostFeedback } from "@/app/actions";

const SEEN_KEY = "xfbk-seen";
const SHOWN_KEY = "xfbk-shown";
const FIRST_TRIGGER = 3;
const REPEAT_EVERY = 3;
const MAX_PER_SESSION = 5;

function readCount(key: string): number {
  try {
    return parseInt(sessionStorage.getItem(key) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {}
}

let activePostId: string | null = null;

export function InterestPrompt({ postId }: { postId: string }) {
  const [phase, setPhase] = useState<"waiting" | "asking" | "done">("waiting");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || phase !== "waiting") continue;
          const seen = readCount(SEEN_KEY) + 1;
          writeCount(SEEN_KEY, seen);
          observer.disconnect();
          const shown = readCount(SHOWN_KEY);
          const due =
            shown < MAX_PER_SESSION &&
            activePostId === null &&
            (seen === FIRST_TRIGGER || ((seen - FIRST_TRIGGER) % REPEAT_EVERY === 0));
          if (due && Math.random() < 0.9) {
            activePostId = postId;
            setPhase("asking");
            writeCount(SHOWN_KEY, shown + 1);
          }
          break;
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (activePostId === postId) activePostId = null;
    };
  }, [postId, phase]);

  async function answer(value: "interested" | "not_interested") {
    setPhase("done");
    activePostId = null;
    await submitPostFeedback(postId, value).catch(() => {});
    router.refresh();
  }

  return (
    <div ref={ref}>
      {phase === "asking" && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-full bg-[var(--bg-soft)] px-3 py-1.5 text-xs sm:mx-5">
          <span className="mr-auto text-ink-muted">More like this?</span>
          <button
            onClick={() => answer("interested")}
            className="rounded-full border border-line px-3 py-1 font-semibold text-accent transition-colors hover:bg-[var(--bg-elevated)]"
          >
            Interested
          </button>
          <button
            onClick={() => answer("not_interested")}
            className="rounded-full border border-line px-3 py-1 font-semibold text-ink-muted transition-colors hover:bg-[var(--bg-elevated)]"
          >
            Not interested
          </button>
        </div>
      )}
      {phase === "done" && (
        <p className="mx-4 mb-2 text-xs text-ink-faint sm:mx-5">
          Noted — your feed adapts.
        </p>
      )}
    </div>
  );
}

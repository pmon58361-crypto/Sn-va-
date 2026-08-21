"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage, markThreadRead } from "@/app/dm/actions";
import { timeAgo } from "@/lib/utils";

type Msg = {
  id: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

// Live-ish thread: initial messages rendered server-side are passed in,
// then the client polls the JSON endpoint every 4s for new ones.
export function DmThread({
  otherId,
  meId,
  initial,
}: {
  otherId: string;
  meId: string;
  initial: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAt =
    messages.length > 0
      ? new Date(messages[messages.length - 1].createdAt).toISOString()
      : "";

  // Scroll to bottom on mount / new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark read when opened.
  useEffect(() => {
    markThreadRead(otherId).catch(() => {});
  }, [otherId]);

  // Poll for new incoming messages.
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/dm/${otherId}?after=${encodeURIComponent(lastAt)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: Msg[] };
        if (data.messages?.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
          });
          markThreadRead(otherId).catch(() => {});
        }
      } catch {
        // offline — retry next tick
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [otherId, lastAt]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      senderId: meId,
      content,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    startTransition(async () => {
      try {
        const saved = await sendMessage(otherId, content);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id
              ? { ...m, id: saved.id, createdAt: saved.createdAt }
              : m
          )
        );
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(content);
      }
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-ink-secondary">
            This is the beginning of your conversation. Say hi.
          </p>
        )}
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <div
                key={m.id}
                className={`max-w-[75%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${
                  mine
                    ? "self-end rounded-br-md bg-accent text-white"
                    : "self-start rounded-bl-md bg-surface-hover"
                }`}
                title={new Date(m.createdAt).toLocaleString()}
              >
                <span className="whitespace-pre-wrap break-words">{m.content}</span>
                <span
                  className={`mt-0.5 block text-right text-[11px] ${
                    mine ? "text-white/70" : "text-ink-secondary"
                  }`}
                >
                  {timeAgo(m.createdAt)}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-0 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Start a new message"
            maxLength={2000}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="btn-primary rounded-full px-5 py-2 text-sm"
          >
            Send
          </button>
        </div>
      </form>
    </>
  );
}

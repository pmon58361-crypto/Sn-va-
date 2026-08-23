"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage, markThreadRead } from "@/app/dm/actions";
import { ReportMenu } from "@/components/moderation/ReportMenu";
import { timeAgo } from "@/lib/utils";

type Msg = {
  id: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

// Poll cadence while the tab is focused; polling pauses entirely when the
// tab is hidden and does an immediate catch-up on return.
const POLL_MS = 3000;

// Live-ish thread: initial messages rendered server-side are passed in,
// then the client polls the JSON endpoint for new ones + peer read state.
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
  const [sending, setSending] = useState(false);
  // Newest known time the OTHER person read any of my messages ("Seen").
  const [seenAt, setSeenAt] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Only autoscroll when the user is already reading the latest message.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "auto" })
      );
      return;
    }
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  const poll = useCallback(async () => {
    // Skip network work entirely for background tabs.
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const cur = messagesRef.current;
      const lastAt =
        cur.length > 0 ? cur[cur.length - 1].createdAt : "";
      const res = await fetch(
        `/api/dm/${otherId}?after=${encodeURIComponent(lastAt)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: Msg[];
        seenAt?: string | null;
      };

      if (data.seenAt) {
        setSeenAt((prev) =>
          !prev || new Date(data.seenAt!) > new Date(prev) ? data.seenAt! : prev
        );
      }

      if (data.messages?.length) {
        const seenIds = new Set(cur.map((m) => m.id));
        const fresh = data.messages.filter((m) => !seenIds.has(m.id));
        if (fresh.length === 0) return;
        // Real arrivals animate + count as "read" only when focused.
        if (typeof document === "undefined" || !document.hidden) {
          markThreadRead(otherId).catch(() => {});
        }
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !ids.has(m.id))];
        });
      }
    } catch {
      // offline — retry next tick
    }
  }, [otherId]);

  // Stable polling loop: fixed interval, hidden-tab skip, instant catch-up.
  useEffect(() => {
    const iv = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Mark read when opened.
  useEffect(() => {
    markThreadRead(otherId).catch(() => {});
  }, [otherId]);

  async function submit(e: React.FormEvent) {
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
    atBottomRef.current = true; // sending implies you're looking at the thread
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
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
    } finally {
      setSending(false);
    }
  }

  // Index of my most recent outgoing message — the one that can show "Seen".
  let lastMineIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderId === meId && !messages[i].id.startsWith("tmp-")) {
      lastMineIdx = i;
      break;
    }
  }

  return (
    <>
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={onScroll}
      >
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-ink-secondary">
            This is the beginning of your conversation. Say hi.
          </p>
        )}
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const showSeen =
              mine &&
              i === lastMineIdx &&
              !!seenAt &&
              new Date(seenAt) >= new Date(m.createdAt);
            return (
              <div
                key={m.id}
                className={`flex dm-in ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex max-w-[85%] flex-col gap-0.5 sm:max-w-[75%] ${
                    mine ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`w-fit rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${
                      mine
                        ? "rounded-br-md bg-accent text-white"
                        : "rounded-bl-md bg-surface-hover"
                    }`}
                    title={new Date(m.createdAt).toLocaleString()}
                  >
                    <span className="block whitespace-pre-wrap break-words">
                      {m.content}
                    </span>
                    <span
                      className={`mt-0.5 block text-right text-[11px] ${
                        mine ? "text-white/70" : "text-ink-secondary"
                      }`}
                    >
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                  {showSeen && (
                    <p className="text-[11px] font-medium text-accent">Seen</p>
                  )}
                  {!mine && (
                    <ReportMenu targetType="MESSAGE" targetId={m.id} />
                  )}
                </div>
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

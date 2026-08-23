"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendMessage,
  markThreadRead,
  deleteMessage,
} from "@/app/dm/actions";
import { ReportMenu } from "@/components/moderation/ReportMenu";

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

// Time divider appears when this much time passes between messages.
const DIVIDER_GAP_MS = 30 * 60 * 1000;

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// "9:44 PM" today, "Aug 22, 9:44 PM" otherwise.
function dividerLabel(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(d);
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(
    [],
    sameYear
      ? { month: "short", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" }
  );
  return `${date}, ${fmtTime(d)}`;
}

// Live-ish thread: initial messages rendered server-side are passed in,
// then the client polls the JSON endpoint for new ones, peer read state,
// and a recent-id window so unsent messages disappear for everyone.
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
  // Context menu state (one open menu at a time).
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Close the context menu on any outside click / Escape.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

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
        recentIds?: string[];
        windowStart?: string | null;
      };

      if (data.seenAt) {
        setSeenAt((prev) =>
          !prev || new Date(data.seenAt!) > new Date(prev) ? data.seenAt! : prev
        );
      }

      const fresh =
        data.messages?.length > 0
          ? data.messages.filter(
              (m) => !cur.some((p) => p.id === m.id)
            )
          : [];
      const needsWindowSweep =
        !!data.recentIds && typeof data.windowStart === "string";
      if (fresh.length === 0 && !needsWindowSweep) return;

      // Real arrivals count as "read" only when focused.
      if (fresh.length > 0) {
        if (typeof document === "undefined" || !document.hidden) {
          markThreadRead(otherId).catch(() => {});
        }
      }

      setMessages((prev) => {
        let next =
          fresh.length > 0
            ? [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]
            : prev;
        if (needsWindowSweep) {
          // Drop anything inside the recent window that no longer exists
          // server-side (peer unsent it). Older-than-window rows are kept —
          // they predate what we can verify.
          const live = new Set(data.recentIds!);
          const start = new Date(data.windowStart!).getTime();
          next = next.filter(
            (m) =>
              m.id.startsWith("tmp-") ||
              live.has(m.id) ||
              new Date(m.createdAt).getTime() < start
          );
        }
        return next;
      });
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

  async function copyMessage(m: Msg) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setMenuFor(null);
      }, 900);
    } catch {}
  }

  async function unsend(m: Msg) {
    if (m.id.startsWith("tmp-")) return;
    try {
      await deleteMessage(m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch {
      // keep the message visible if the server refused; next poll reconciles
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
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const showSeen =
              mine &&
              i === lastMineIdx &&
              !!seenAt &&
              new Date(seenAt) >= new Date(m.createdAt);
            const isNewDay =
              i === 0 ||
              new Date(m.createdAt).getTime() -
                new Date(messages[i - 1].createdAt).getTime() >
                DIVIDER_GAP_MS;
            const menuOpen = menuFor === m.id;
            return (
              <div key={m.id} className="flex flex-col dm-in">
                {isNewDay && (
                  <p className="my-2 text-center text-[11px] font-medium text-ink-faint">
                    {dividerLabel(m.createdAt)}
                  </p>
                )}
                <div
                  className={`flex items-center gap-1.5 ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Context menu trigger — outer side of the bubble */}
                  <div className={`relative ${mine ? "" : "order-first"}`}>
                    <button
                      type="button"
                      aria-label="Message options"
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCopied(false);
                        setMenuFor(menuOpen ? null : m.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCopied(false);
                        setMenuFor(m.id);
                      }}
                      className={`grid h-6 w-6 place-items-center rounded-full text-ink-faint transition hover:bg-soft hover:text-ink ${
                        menuOpen ? "!bg-soft !text-ink" : ""
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                      </svg>
                    </button>

                    {menuOpen && (
                      <div
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`absolute bottom-full z-30 mb-2 w-48 rounded-xl border border-line bg-surface p-1 shadow-lg ${
                          mine ? "right-0" : "left-0"
                        }`}
                      >
                        <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-muted">
                          {dividerLabel(m.createdAt)}
                          <span className="block text-[10px] font-normal text-ink-faint">
                            {new Date(m.createdAt).toLocaleString()}
                          </span>
                        </p>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => copyMessage(m)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink"
                        >
                          Copy
                          {copied && (
                            <span className="text-[11px] text-accent">Copied</span>
                          )}
                        </button>
                        {mine && !m.id.startsWith("tmp-") && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => unsend(m)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-warm transition-colors hover:bg-warm-tint"
                          >
                            Unsend
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCopied(false);
                        setMenuFor(m.id);
                      }}
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
                    </div>
                  </div>
                </div>
                {showSeen && (
                  <p className="mt-0.5 text-right text-[11px] font-medium text-accent">
                    Seen
                  </p>
                )}
                {!mine && (
                  <ReportMenu
                    targetType="MESSAGE"
                    targetId={m.id}
                    className="mt-0.5"
                  />
                )}
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

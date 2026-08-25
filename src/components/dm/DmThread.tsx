"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendMessage,
  markThreadRead,
  deleteMessage,
  toggleMessageReaction,
} from "@/app/dm/actions";
import { reportTarget } from "@/app/actions";
import { timeAgo } from "@/lib/utils";

type Reaction = { messageId: string; userId: string; emoji: string };

type Msg = {
  id: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  reactions?: Reaction[];
};

// Poll cadence while the tab is focused; polling pauses entirely when the
// tab is hidden and does an immediate catch-up on return.
const POLL_MS = 3000;

// Time divider appears when this much time passes between messages.
const DIVIDER_GAP_MS = 30 * 60 * 1000;

// Consecutive same-sender messages within this window stack tight
// (Discord-style grouping) instead of full-gap bubbles.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// One-tap openers for brand-new conversations.
const ICEBREAKERS = [
  "What are you building right now?",
  "Any wins this week?",
  "How can the community help you?",
];

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👍", "😮", "😢"];
const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or abuse",
  "Misinformation",
  "Illegal content",
];

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
// reactions, and a recent-id window so unsent messages disappear for all.
export function DmThread({
  otherId,
  meId,
  initial,
  initialDraft,
  autoFocusComposer,
}: {
  otherId: string;
  meId: string;
  initial: Msg[];
  /** Pre-filled text for the composer (e.g. story-reply deep links). */
  initialDraft?: string;
  /** Focus the composer on mount (deep-link reply flows). */
  autoFocusComposer?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [reactions, setReactions] = useState<Reaction[]>(
    initial.flatMap((m) => m.reactions ?? [])
  );
  const [draft, setDraft] = useState(initialDraft ?? "");
  const composerRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  // Newest known time the OTHER person read any of my messages ("Seen").
  const [seenAt, setSeenAt] = useState<string | null>(null);
  // One open popover at a time: which message, and which layer of it.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuMode, setMenuMode] = useState<"main" | "reasons">("main");
  const [copied, setCopied] = useState(false);
  // Mobile affordance: tapped bubble reveals its quick-bar.
  const [activeBarId, setActiveBarId] = useState<string | null>(null);
  const [reportedId, setReportedId] = useState<string | null>(null);

  // Deep-link reply flows drop the cursor straight into the composer.
  useEffect(() => {
    if (autoFocusComposer) composerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const messagesRef = useRef(messages);
  // Server-authoritative poll cursor (ISO). Initialized from SSR data
  // (server clock); advanced ONLY from poll responses — see poll().
  const cursorRef = useRef<string>(
    initial.length > 0 ? initial[initial.length - 1].createdAt : ""
  );
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Close popovers on outside click / Escape.
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
      // Cursor priority: server-issued cursor > last local message ts.
      // Locally-generated timestamps (optimistic rows) carry the CLIENT
      // clock — with any skew they outrun server time and silently filter
      // incoming messages until reload. The server cursor is the fix.
      const cur = messagesRef.current;
      const lastAt =
        cursorRef.current ||
        (cur.length > 0 ? cur[cur.length - 1].createdAt : "");
      const res = await fetch(
        `/api/dm/${otherId}?after=${encodeURIComponent(lastAt)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: Msg[];
        reactions?: Reaction[];
        seenAt?: string | null;
        recentIds?: string[];
        windowStart?: string | null;
        cursor?: string | null;
      };
      if (data.cursor) cursorRef.current = data.cursor;

      if (data.seenAt) {
        setSeenAt((prev) =>
          !prev || new Date(data.seenAt!) > new Date(prev) ? data.seenAt! : prev
        );
      }
      if (data.reactions) setReactions(data.reactions);

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
        return next.map((m) =>
          data.messages?.some((f) => f.id === m.id && f.reactions)
            ? { ...m, reactions: data.messages.find((f) => f.id === m.id)!.reactions }
            : m
        );
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
            ? { ...m, id: saved.id, createdAt: saved.createdAt, reactions: [] }
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
      setReactions((prev) => prev.filter((r) => r.messageId !== m.id));
    } catch {
      // keep the message visible if the server refused; next poll reconciles
    }
  }

  async function reportMessage(m: Msg, reason: string) {
    try {
      await reportTarget({
        targetType: "MESSAGE",
        targetId: m.id,
        reason,
      });
      setReportedId(m.id);
      setTimeout(() => setReportedId(null), 2500);
    } catch {}
    setMenuFor(null);
  }

  async function react(m: Msg, emoji: string) {
    if (m.id.startsWith("tmp-")) return;
    // Optimistic toggle; the next poll reconciles any drift.
    const before = reactions;
    const existingMine = before.some(
      (r) => r.messageId === m.id && r.userId === meId && r.emoji === emoji
    );
    setReactions(
      existingMine
        ? before.filter(
            (r) =>
              !(
                r.messageId === m.id &&
                r.userId === meId &&
                r.emoji === emoji
              )
          )
        : [...before, { messageId: m.id, userId: meId, emoji }]
    );
    try {
      await toggleMessageReaction(m.id, emoji);
    } catch {
      setReactions(before);
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        onScroll={onScroll}
      >
        {messages.length === 0 && (
          <div className="mx-auto max-w-3xl py-14 text-center">
            <p className="text-sm text-ink-secondary">
              This is the beginning of your conversation. Say hi.
            </p>
            {/* Icebreakers — one tap fills the composer; kills the blank-canvas
                moment in brand-new conversations. */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {ICEBREAKERS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setDraft(prompt);
                    composerRef.current?.focus();
                  }}
                  className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink-muted transition hover:border-accent hover:text-accent"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col">
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const prev = i > 0 ? messages[i - 1] : null;
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
            // Discord-style stacking: same sender within the window glues to
            // the previous bubble (tight gap, flattened top seam corners).
            const stacked =
              !isNewDay &&
              !!prev &&
              prev.senderId === m.senderId &&
              new Date(m.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <
                GROUP_WINDOW_MS;

            // Aggregate reactions for this message from the thread-wide map.
            const grouped = new Map<
              string,
              { count: number; mine: boolean }
            >();
            for (const r of reactions) {
              if (r.messageId !== m.id) continue;
              const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
              g.count += 1;
              if (r.userId === meId) g.mine = true;
              grouped.set(r.emoji, g);
            }
            const hasReactions = grouped.size > 0;

            return (
              <div
                key={m.id}
                className={`flex flex-col dm-in ${stacked ? "-mt-2.5" : ""}`}
              >
                {isNewDay && (
                  <p className="my-2 text-center text-[11px] font-medium text-ink-faint">
                    {dividerLabel(m.createdAt)}
                  </p>
                )}
                <div
                  className={`group relative flex items-end gap-1.5 ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Hover / tap quick-bar: reactions + options trigger.
                      Anchored INSIDE the bubble's top edge so it can never
                      clip against the scroll container or viewport edge. */}
                  {!m.id.startsWith("tmp-") && (
                    <div
                      className={`absolute top-1 z-20 items-center gap-0.5 whitespace-nowrap rounded-full border border-line bg-surface px-1 py-0.5 shadow-md transition-opacity ${
                        mine ? "right-1" : "left-1"
                      } ${
                        activeBarId === m.id
                          ? "flex"
                          : "hidden group-hover:flex opacity-0 group-hover:opacity-100"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(m, emoji)}
                          className="rounded-full px-0.5 text-sm leading-none transition-transform hover:scale-125"
                          aria-label={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <span className="mx-0.5 h-4 w-px bg-line" />
                      <button
                        type="button"
                        aria-label="Message options"
                        aria-haspopup="menu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopied(false);
                          setMenuMode("main");
                          setMenuFor(menuOpen ? null : m.id);
                        }}
                        className="grid h-6 w-6 place-items-center rounded-full text-ink-faint transition hover:bg-soft hover:text-ink"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <circle cx="12" cy="5" r="1.6" />
                          <circle cx="12" cy="12" r="1.6" />
                          <circle cx="12" cy="19" r="1.6" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="min-w-0">
                    <div
                      onClick={(e) => {
                        // Mobile affordance: tap bubble to reveal the bar.
                        e.stopPropagation();
                        setActiveBarId(activeBarId === m.id ? null : m.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCopied(false);
                        setMenuMode("main");
                        setMenuFor(m.id);
                      }}
                      className={`w-fit cursor-default px-4 py-2.5 text-[15px] leading-snug ${
                        stacked
                          ? "rounded-xl rounded-t-md" // seam side flattened
                          : "rounded-3xl"
                      } ${
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

                    {/* Reaction pills — real counts only */}
                    {hasReactions && (
                      <div
                        className={`mt-1 flex gap-1 ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {[...grouped.entries()].map(([emoji, g]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              react(m, emoji);
                            }}
                            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition ${
                              g.mine
                                ? "border-accent bg-accent/10"
                                : "border-line bg-surface hover:border-accent"
                            }`}
                            aria-label={`${emoji} ${g.count}`}
                          >
                            <span>{emoji}</span>
                            {g.count > 1 && (
                              <span className="text-[10px] font-semibold text-ink-muted">
                                {g.count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {showSeen && (
                      <p className="mt-0.5 text-right text-[11px] font-medium text-accent">
                        Seen
                      </p>
                    )}
                  </div>
                </div>

                {/* Context menu */}
                {menuOpen && (
                  <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`z-30 mt-1 w-48 rounded-xl border border-line bg-surface p-1 shadow-lg ${
                      mine ? "mr-2 self-end" : "ml-2 self-start"
                    }`}
                  >
                    <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-muted">
                      {dividerLabel(m.createdAt)}
                      <span className="block text-[10px] font-normal text-ink-faint">
                        {new Date(m.createdAt).toLocaleString()} · {timeAgo(m.createdAt)}
                      </span>
                    </p>
                    {menuMode === "main" ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => copyMessage(m)}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-soft hover:text-ink"
                        >
                          Copy
                          {copied && (
                            <span className="ml-2 text-[11px] text-accent">Copied</span>
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
                        {!mine && !m.id.startsWith("tmp-") && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setMenuMode("reasons")}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-warm-tint ${
                              reportedId === m.id ? "text-accent" : "text-warm"
                            }`}
                          >
                            {reportedId === m.id ? "✓ Reported" : "Report"}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {REPORT_REASONS.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            role="menuitem"
                            onClick={() => reportMessage(m, reason)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-xs text-warm transition-colors hover:bg-warm-tint"
                          >
                            {reason}
                          </button>
                        ))}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setMenuMode("main")}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs text-ink-faint transition-colors hover:bg-soft"
                        >
                          Back
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={submit}
        className="border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            ref={composerRef}
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
    </div>
  );
}

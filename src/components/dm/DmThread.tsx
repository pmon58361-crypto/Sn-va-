"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendMessage,
  markThreadRead,
  deleteMessage,
  toggleMessageReaction,
} from "@/app/dm/actions";
import { reportTarget } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

type Reaction = { messageId: string; userId: string; emoji: string };

type Msg = {
  id: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  readAt: string | null;
  createdAt: string;
  reactions?: Reaction[];
};

// Poll cadence while the tab is focused; polling pauses entirely when the
// tab is hidden and does an immediate catch-up on return.
const POLL_MS = 3000;

// Consecutive same-sender messages within this window stack tight
// (Discord-style grouping) instead of full-gap rows.
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

// Discord-style day divider: full date, no time ("August 25, 2026").
// Times live on each message header and the hover gutter instead.
function dividerLabel(ts: string) {
  return new Date(ts).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Live-ish thread: initial messages rendered server-side are passed in,
// then the client polls the JSON endpoint for new ones, peer read state,
// reactions, and a recent-id window so unsent messages disappear for all.
export function DmThread({
  otherId,
  meId,
  otherName,
  otherImage,
  meName,
  meImage,
  initial,
  initialDraft,
  autoFocusComposer,
}: {
  otherId: string;
  meId: string;
  otherName?: string | null;
  otherImage?: string | null;
  meName?: string | null;
  meImage?: string | null;
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  // Attached photo (uploaded via /api/upload, sent with the next message).
  const [attached, setAttached] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function attachFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAttachError("Only images can be attached");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachError("Image exceeds 5MB");
      return;
    }
    setAttachError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Upload failed");
      }
      const data = (await res.json()) as { urls: string[] };
      if (!data.urls?.[0]) throw new Error("Upload failed");
      setAttached(data.urls[0]);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  // Newest known time the OTHER person read any of my messages ("Seen").
  const [seenAt, setSeenAt] = useState<string | null>(null);
  // One open popover at a time: which message, and which layer of it.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuMode, setMenuMode] = useState<"main" | "reasons">("main");
  const [copied, setCopied] = useState(false);
  // Which message's emoji picker popup is open (Discord-style toolbar).
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  // Transient toolbar copy confirmation (icon swap to a checkmark).
  const [quickCopiedId, setQuickCopiedId] = useState<string | null>(null);
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
    if (!menuFor && !emojiFor) return;
    const close = () => {
      setMenuFor(null);
      setEmojiFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor, emojiFor]);

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
        return next.map((m) => {
          const f = data.messages?.find((x) => x.id === m.id);
          if (!f) return m;
          // Reconcile server truth onto local rows: reactions always, plus
          // imageUrl for rows created before the photo column existed
          // client-side (old cached threads, cross-device views).
          return {
            ...m,
            imageUrl: (f as Msg).imageUrl ?? m.imageUrl ?? null,
            ...(f.reactions ? { reactions: f.reactions } : {}),
          };
        });
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
    if ((!content && !attached) || sending || uploading) return;
    setDraft("");
    const imageUrl = attached;
    setAttached(null);
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      senderId: meId,
      content,
      imageUrl,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    atBottomRef.current = true; // sending implies you're looking at the thread
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const saved = await sendMessage(otherId, content, imageUrl ?? undefined);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id
            ? { ...m, id: saved.id, createdAt: saved.createdAt, imageUrl: saved.imageUrl ?? m.imageUrl ?? null, reactions: [] }
            : m
        )
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      if (imageUrl) setAttached(imageUrl);
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

  // Toolbar copy: same clipboard write as the menu item, but feedback is the
  // button itself swapping to a checkmark for a beat.
  function quickCopy(m: Msg) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(m.content).catch(() => {});
    }
    setQuickCopiedId(m.id);
    window.setTimeout(() => setQuickCopiedId(null), 1200);
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
            // Day divider: a new calendar day (Discord shows one pill per
            // day, never two identical pills in a row).
            const isNewDay =
              i === 0 ||
              new Date(m.createdAt).toDateString() !==
                new Date(messages[i - 1].createdAt).toDateString();
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
            // Last bubble of a group shows the timestamp (+ Seen for mine).
            const next = i + 1 < messages.length ? messages[i + 1] : null;
            const groupLast =
              !next ||
              next.senderId !== m.senderId ||
              new Date(next.createdAt).getTime() -
                new Date(m.createdAt).getTime() >=
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
                className={`group/row relative dm-in ${stacked ? "" : "mt-4"}`}
              >
                {isNewDay && (
                  <p data-testid="time-divider" className="my-3 flex justify-center">
                    <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-ink-muted">
                      {dividerLabel(m.createdAt)}
                    </span>
                  </p>
                )}
                {/* Discord-cozy row: full-bleed hover wash, avatar per group,
                    hover timestamp gutter for stacked rows. */}
                <div className="-mx-4 px-4 py-0.5 transition-colors hover:bg-surface-hover/60">
                <div className="mx-auto flex max-w-3xl gap-3">
                  {stacked ? (
                    <span
                      aria-hidden
                      className="w-10 shrink-0 select-none pt-1 text-center text-[10px] tabular-nums text-ink-faint opacity-0 transition group-hover/row:opacity-100"
                    >
                      {fmtTime(new Date(m.createdAt))}
                    </span>
                  ) : (
                    <Avatar
                      name={mine ? meName : otherName}
                      image={mine ? meImage : otherImage}
                      size={40}
                    />
                  )}
                  {/* Hover rail — floats above the row's top-right edge
                      (Discord placement), never inside the text flow. */}
                  {!m.id.startsWith("tmp-") && (
                    <div
                      className={`absolute -top-5 right-4 z-20 items-center gap-0.5 whitespace-nowrap rounded-lg border border-line bg-surface px-0.5 py-0.5 shadow-md transition-opacity ${
                        activeBarId === m.id
                          ? "flex"
                          : "hidden group-hover/row:flex opacity-0 group-hover/row:opacity-100"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label="Add reaction"
                        aria-expanded={emojiFor === m.id}
                        onClick={() =>
                          setEmojiFor(emojiFor === m.id ? null : m.id)
                        }
                        className={`grid h-6 w-6 place-items-center rounded-md transition hover:bg-soft hover:text-ink ${
                          emojiFor === m.id
                            ? "text-accent"
                            : "text-ink-faint"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M8.5 14.5c.9 1 2.1 1.6 3.5 1.6s2.6-.6 3.5-1.6" strokeLinecap="round" />
                          <circle cx="9" cy="10" r="0.6" fill="currentColor" stroke="none" />
                          <circle cx="15" cy="10" r="0.6" fill="currentColor" stroke="none" />
                        </svg>
                      </button>
                      <span className="h-4 w-px bg-line" />
                      {/* Copy only exists when there is text — image-only
                          messages have nothing to copy. */}
                      {m.content.trim() && (
                        <>
                          <button
                            type="button"
                            aria-label="Copy message"
                            onClick={() => quickCopy(m)}
                            className={`grid h-6 w-6 place-items-center rounded-md transition hover:bg-soft hover:text-ink ${
                              quickCopiedId === m.id ? "text-accent" : "text-ink-faint"
                            }`}
                          >
                            {quickCopiedId === m.id ? (
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <rect x="9" y="9" width="11" height="11" rx="2" />
                                <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}
                      <span className="h-4 w-px bg-line" />
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
                        className="grid h-6 w-6 place-items-center rounded-md text-ink-faint transition hover:bg-soft hover:text-ink"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <circle cx="12" cy="5" r="1.6" />
                          <circle cx="12" cy="12" r="1.6" />
                          <circle cx="12" cy="19" r="1.6" />
                        </svg>
                      </button>

                      {/* Emoji picker popup — opened from the smiley icon. */}
                      {emojiFor === m.id && (
                        <div
                          className="absolute right-0 top-full z-30 mt-1 flex gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-lg"
                        >
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                react(m, emoji);
                                setEmojiFor(null);
                              }}
                              className="rounded-full px-1 text-base leading-none transition-transform hover:scale-125"
                              aria-label={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* min-w-0 flex-1: the %-based bubble cap below MUST
                      resolve against full row width. A shrink-wrapped
                      wrapper makes max-w-[78%] circular (78% of fit
                      content ≈ min-content) and stacks one letter per
                      line — the classic collapse. */}
                  <div className="min-w-0 flex-1">
                    {/* Group header: name + full timestamp (Discord cozy).
                        Stacked rows skip it — the gutter timestamp covers
                        them on hover. */}
                    {!stacked && (
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[15px] font-semibold text-ink">
                          {mine ? meName || "You" : otherName || "Someone"}
                        </span>
                        <span className="text-[11px] text-ink-faint">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </p>
                    )}
                    <div
                      onClick={(e) => {
                        // Mobile affordance: tap text to reveal the bar.
                        e.stopPropagation();
                        setActiveBarId(activeBarId === m.id ? null : m.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCopied(false);
                        setMenuMode("main");
                        setMenuFor(m.id);
                      }}
                      title={new Date(m.createdAt).toLocaleString()}
                    >
                      {m.imageUrl && (
                        <a
                          href={m.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mb-1.5 block max-w-md overflow-hidden rounded-xl"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.imageUrl}
                            alt=""
                            loading="lazy"
                            className="max-h-64 w-full object-cover"
                          />
                        </a>
                      )}
                      {m.content && (
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
                          {m.content}
                        </p>
                      )}
                    </div>

                    {/* Reaction pills — real counts only, always left-docked
                        (Discord cozy has no per-side alignment). */}
                    {hasReactions && (
                      <div className="mt-1 flex gap-1">
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

                    {groupLast && showSeen && (
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        <span className="font-semibold text-ink-muted">
                          Seen {fmtTime(new Date(seenAt!))}
                        </span>
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
                        {m.content.trim() && (
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
                        )}
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
        {/* Discord composer: one gray box, + on the left, send on the
            right, "Message @name" placeholder. */}
        <div className="mx-auto flex max-w-3xl items-end gap-1 rounded-2xl border border-line bg-surface px-2 py-2 transition-colors focus-within:border-line-strong">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => attachFile(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending || uploading || !!attached}
            aria-label="Attach a photo"
            title="Attach a photo"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-40"
          >
            {uploading ? "…" : "+"}
          </button>
          <textarea
            ref={composerRef}
            data-testid="dm-composer"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Auto-grow up to ~6 lines, then scroll internally.
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 148) + "px";
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a newline.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder={`Message @${otherName || "them"}`}
            maxLength={2000}
            rows={1}
            className="max-h-[148px] flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            data-testid="dm-send"
            disabled={sending || uploading || (!draft.trim() && !attached)}
            aria-label="Send message"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-hover text-ink-muted transition hover:bg-accent hover:text-white disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {(attached || attachError) && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2">
            {attached && (
              <span className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attached}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttached(null)}
                  aria-label="Remove attachment"
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-warm text-xs text-white"
                >
                  ×
                </button>
              </span>
            )}
            {attachError && (
              <span className="text-xs text-warm">{attachError}</span>
            )}
          </div>
        )}
        <p className="mx-auto mt-1 max-w-3xl text-[11px] text-ink-faint">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}

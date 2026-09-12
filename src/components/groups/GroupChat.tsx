"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  imageUrl: string | null;
  anonymous: boolean;
  createdAt: string;
  sender: { id: string; name: string | null; image: string | null } | null;
};

const POLL_MS = 3000;

// Per-group member room. Deliberately simpler than 1:1 DMs: no read
// receipts, no reactions, no menus — a fast scrolling room with photos.
// Polls the JSON endpoint on a fixed interval, pausing in background tabs.
export function GroupChat({
  slug,
  meId,
  initial,
}: {
  slug: string;
  meId: string;
  initial: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Per-message mask: sent as Anonymous, rendered sender-free for
  // everyone. The real senderId stays stored for moderation.
  const [anon, setAnon] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<string | null>(
    initial.length > 0 ? initial[initial.length - 1].createdAt : null
  );

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poll = useCallback(async () => {
    if (document.hidden) return;
    try {
      const url =
        `/api/groups/${slug}/chat` +
        (cursorRef.current ? `?after=${encodeURIComponent(cursorRef.current)}` : "");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      const fresh = (data.messages ?? []).filter(
        (m) => !messages.some((x) => x.id === m.id)
      );
      if (fresh.length > 0) {
        // Near-bottom keeps following live chat; scrolled-up history stays put.
        const nearBottom =
          window.innerHeight + window.scrollY > document.body.scrollHeight - 400;
        setMessages((prev) => [...prev, ...fresh]);
        cursorRef.current = fresh[fresh.length - 1].createdAt;
        if (nearBottom) setTimeout(scrollDown, 50);
      }
    } catch {
      // Next tick retries; chat degrades to manual refresh, never crashes.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, messages, scrollDown]);

  useEffect(() => {
    const iv = setInterval(poll, POLL_MS);
    return () => clearInterval(iv);
  }, [poll]);

  async function attachFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || sending || uploading) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setAttachError("Pick an image under 5MB");
      return;
    }
    setAttachError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[] };
      if (!res.ok || !data.urls?.[0]) throw new Error();
      setAttached(data.urls[0]);
    } catch {
      setAttachError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const content = draft.trim();
    if (sending || uploading || (!content && !attached)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/groups/${slug}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, imageUrl: attached, anonymous: anon }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { message?: ChatMessage };
      if (data.message) {
        setMessages((prev) =>
          prev.some((x) => x.id === data.message!.id) ? prev : [...prev, data.message!]
        );
        cursorRef.current = data.message.createdAt;
      }
      setDraft("");
      setAttached(null);
      setTimeout(scrollDown, 50);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card flex min-h-[50vh] flex-col overflow-hidden">
      <div className="max-h-[55vh] min-h-[30vh] flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            No messages yet — say hi to the room.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId;
            const masked = m.anonymous;
            return (
              <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                {masked ? (
                  <span className="shrink-0" aria-hidden>
                    <Avatar name="Anonymous" image={null} size={32} />
                  </span>
                ) : (
                  <Link href={`/profile/${m.sender?.id ?? m.senderId}`} className="shrink-0">
                    <Avatar name={m.sender?.name} image={m.sender?.image} size={32} />
                  </Link>
                )}
                <div className={`min-w-0 max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <span className="mb-0.5 text-[11px] text-ink-faint">
                    {masked ? (mine ? "Anonymous (you)" : "Anonymous") : mine ? "You" : m.sender?.name || "Someone"}
                  </span>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
                      mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-soft text-ink"
                    }`}
                  >
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt=""
                        loading="lazy"
                        className="mb-1.5 max-h-56 w-full rounded-xl object-cover"
                      />
                    )}
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                  </div>
                  <span className="mt-0.5 text-[10px] text-ink-faint">
                    {timeAgo(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-line bg-bg/95 p-3">
        {attached && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attached} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
            <span className="text-xs text-ink-secondary">Photo attached</span>
            <button
              type="button"
              onClick={() => setAttached(null)}
              aria-label="Remove photo"
              // 32px hit area (was 28px) — reachable on touch.
              className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition hover:bg-surface-hover hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}
        {attachError && <p className="mb-2 text-xs text-warm">{attachError}</p>}
        <div className="flex items-end gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            // Camera-first on phones (desktop ignores it). Single-file
            // input so the attribute actually takes effect on mobile.
            capture="environment"
            className="hidden"
            onChange={(e) => attachFile(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending || uploading || !!attached}
            aria-label="Attach a photo"
            title="Attach a photo"
            className="grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-full text-xl leading-none text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-40"
          >
            {uploading ? "…" : "+"}
          </button>
          <button
            type="button"
            onClick={() => setAnon((v) => !v)}
            aria-pressed={anon}
            aria-label={anon ? "Send as yourself" : "Send anonymously"}
            title={anon ? "Anonymous on — tap to reveal yourself" : "Send anonymously"}
            className={`grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-full text-lg leading-none transition disabled:opacity-40 ${
              anon
                ? "bg-accent-tint text-accent"
                : "text-ink-muted hover:bg-surface-hover hover:text-ink"
            }`}
          >
            <span aria-hidden>🎭</span>
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Message the room…"
            aria-label="Message the room"
            maxLength={2000}
            rows={1}
            className="max-h-[120px] flex-1 resize-none overflow-y-auto rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-line-strong sm:text-[15px]"
          />
          <button
            type="submit"
            disabled={sending || uploading || (!draft.trim() && !attached)}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

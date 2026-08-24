"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStory, viewStory } from "@/app/stories/actions";
import { cdnUrl } from "@/lib/cdn";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { XIcon } from "@/components/ui/Icons";

export type StoryGroup = {
  author: { id: string; name: string | null; image: string | null };
  items: {
    id: string;
    imageUrl: string | null;
    caption: string | null;
    bg: string | null;
    createdAt: Date | string;
    seen: boolean;
    isMine: boolean;
    viewCount: number;
  }[];
  hasUnseen: boolean;
};

const BG_CHOICES = ["#1d9bf0", "#f91880", "#00ba7c", "#ffd400", "#7856ff", "#ff7a00"];

export function StoriesBar({
  groups,
  meId,
}: {
  groups: StoryGroup[];
  meId?: string | null;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);

  return (
    <div className="border-b border-line px-4 py-3">
      <div className="flex items-center gap-4 overflow-x-auto pb-1">
        {/* Add story */}
        <button
          onClick={() => setComposerOpen(true)}
          className="flex w-[84px] shrink-0 flex-col items-center"
        >
          {/* Same reserved slot as note bubbles keeps all rows aligned */}
          <span className="mb-1 h-8 shrink-0" aria-hidden />
          <span className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-line-strong text-2xl font-light text-ink-secondary">
            +
          </span>
          <span className="w-full truncate text-center text-[13px] text-ink-secondary">
            Your story
          </span>
        </button>

        {groups.map((g) => {
          // Latest story drives the IG-notes-style bubble above the ring.
          const latest = g.items[g.items.length - 1];
          const showNote = !!latest && !latest.imageUrl && !!latest.caption;
          return (
            <button
              key={g.author.id}
              onClick={() => setViewing(g)}
              className="flex w-[84px] shrink-0 flex-col items-center"
            >
              {/* Reserved slot: note bubble sits above the ring without shifting rows */}
              <span className="mb-1 flex h-8 items-end justify-center">
                {showNote && (
                  <span className="relative inline-block max-w-[80px]">
                    <span
                      className="block truncate rounded-lg border border-line-strong px-2 py-1 text-[11px] font-medium text-white"
                      style={{ background: latest!.bg || "#262626" }}
                    >
                      {latest!.caption}
                    </span>
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 rounded-[1px]"
                      style={{ background: latest!.bg || "#262626", borderTop: "1px solid rgba(255,255,255,0.15)", borderLeft: "1px solid rgba(255,255,255,0.15)" }}
                    />
                  </span>
                )}
              </span>
              <Ring seen={!g.hasUnseen} image={g.author.image} name={g.author.name} />
              <span className="mt-0.5 w-full truncate text-center text-[13px] text-ink-secondary">
                {g.author.id === meId ? "You" : g.author.name || "Someone"}
              </span>
            </button>
          );
        })}
      </div>

      {composerOpen && <StoryComposer onClose={() => setComposerOpen(false)} />}
      {viewing && (
        <StoryViewer group={viewing} meId={meId} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

// Instagram-style ring: colored halo, thin bg gap, avatar.
function Ring({
  seen,
  image,
  name,
}: {
  seen: boolean;
  image?: string | null;
  name?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const [lastImage, setLastImage] = useState(image);
  if (image !== lastImage) {
    setLastImage(image);
    setBroken(false);
  }

  if (image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt=""
        onError={() => setBroken(true)}
        className={`h-20 w-20 rounded-full object-cover p-[3px] ${seen ? "" : "bg-gradient-to-tr from-accent to-like"}`}
      />
    );
  }
  return (
    <span
      className={`grid h-20 w-20 place-items-center rounded-full p-[3px] ${
        seen ? "bg-line-strong" : "bg-gradient-to-tr from-accent to-like"
      }`}
    >
      <span className="grid h-full w-full place-items-center rounded-full bg-bg text-lg font-bold">
        {(name || "?").charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

/* ---------------- Composer ---------------- */

function StoryComposer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [caption, setCaption] = useState("");
  const [bg, setBg] = useState(BG_CHOICES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function submit() {
    if (pending) return;
    setError(null);
    const form = new FormData();
    form.append("bg", bg);
    if (caption.trim()) form.append("caption", caption.trim());
    if (file) form.append("file", file);
    setPending(true);
    try {
      const res = await createStory(form);
      if (!res.ok) {
        setError(res.error || "Failed");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div
        className="card w-full max-w-md bg-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Add to your story</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-surface-hover">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-hover/50 p-1 text-sm font-bold">
          <button onClick={() => setMode("text")} className={`rounded-lg py-1.5 ${mode === "text" ? "bg-bg" : "text-ink-secondary"}`}>Text</button>
          <button onClick={() => setMode("image")} className={`rounded-lg py-1.5 ${mode === "image" ? "bg-bg" : "text-ink-secondary"}`}>Photo</button>
        </div>

        {mode === "text" ? (
          <>
            <div
              className="mb-3 grid min-h-[180px] place-items-center rounded-2xl p-6 text-center text-xl font-bold text-white"
              style={{ background: bg }}
            >
              {caption || "Your text here"}
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="What's happening?"
              className="input mb-3 resize-none"
            />
            <div className="mb-4 flex gap-2">
              {BG_CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBg(c)}
                  aria-label={`Background ${c}`}
                  className={`h-7 w-7 rounded-full border-2 ${bg === c ? "border-ink" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="mb-3 grid h-[220px] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong text-sm text-ink-secondary"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                "Tap to choose a photo"
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setPreview(URL.createObjectURL(f));
                }
                e.target.value = "";
              }}
            />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Optional caption"
              className="input mb-4"
              maxLength={200}
            />
          </>
        )}

        {error && <p className="mb-3 text-sm text-warm">{error}</p>}

        <button
          onClick={submit}
          disabled={pending}
          className="btn-primary w-full py-2.5"
        >
          {pending ? "Sharing..." : "Share story"}
        </button>
        <p className="mt-2 text-center text-xs text-ink-faint">Stories disappear after 24 hours.</p>
      </div>
    </div>
  );
}

/* ---------------- Viewer ---------------- */

function StoryViewer({
  group,
  meId,
  onClose,
}: {
  group: StoryGroup;
  meId?: string | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [authorPicBroken, setAuthorPicBroken] = useState(false);
  const item = group.items[index];
  const router = useRouter();

  const isImage = !!item?.imageUrl;

  // Mark viewed on show.
  useEffect(() => {
    if (!item) return;
    viewStory(item.id).catch(() => {});
  }, [item?.id]);

  // Progress timer: 5s per story.
  useEffect(() => {
    setProgress(0);
    const started = Date.now();
    const iv = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / 5000) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(iv);
        next();
      }
    }, 50);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, index, group.items.length]);

  function next() {
    if (index < group.items.length - 1) setIndex((i) => i + 1);
    else done();
  }
  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }
  function done() {
    onClose();
    router.refresh();
  }

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {group.items.map((_, i) => (
          <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full bg-white transition-[width] duration-75"
              style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
            />
          </span>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="flex items-center gap-2 text-sm font-bold">
          {group.author.image && !authorPicBroken && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.author.image}
              alt=""
              onError={() => setAuthorPicBroken(true)}
              className="h-8 w-8 rounded-full object-cover"
            />
          )}
          {(!group.author.image || authorPicBroken) && (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold">
              {(group.author.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
          {group.author.name || "Someone"}
          <span className="font-normal text-white/60">{timeAgo(item.createdAt)}</span>
        </span>
        <button onClick={done} aria-label="Close" className="rounded-full p-1 hover:bg-white/10">
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 items-center justify-center px-4 pb-10">
        {/* Tap left/right thirds to navigate (IG pattern) */}
        <button
          onClick={prev}
          className="absolute left-0 top-0 h-full w-1/3"
          aria-label="Previous"
          tabIndex={-1}
        />
        <button
          onClick={next}
          className="absolute right-0 top-0 h-full w-1/3"
          aria-label="Next"
          tabIndex={-1}
        />

        {isImage ? (
          <figure className="max-h-full max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cdnUrl(item.imageUrl!, 900)} alt="" className="max-h-[75vh] rounded-2xl object-contain" />
            {item.caption && (
              <figcaption className="mt-3 text-center text-lg font-semibold text-white">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ) : (
          /* Text notes float as a small bubble tucked onto the avatar -- IG-notes style */
          <div className="flex flex-col items-center">
            <div className="relative z-10 mb-[-14px] flex justify-center">
              <div
                className="max-w-[230px] rounded-2xl px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xl"
                style={{ background: item.bg || "#1d9bf0" }}
              >
                {item.caption}
              </div>
              <span
                aria-hidden
                className="absolute -bottom-1 right-8 h-2.5 w-2.5 rotate-45 rounded-[2px]"
                style={{ background: item.bg || "#1d9bf0" }}
              />
            </div>
            <Avatar name={group.author.name} image={group.author.image} size={84} />
          </div>
        )}

        {item.isMine && (
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
            {item.viewCount} {item.viewCount === 1 ? "view" : "views"}
          </span>
        )}
      </div>

      {/* Reply bar — deep-links to the author's DM thread with the composer
          focused. Hearts omitted deliberately: story reactions have no data
          backing yet, and we don't ship decorative-only controls. */}
      {!item.isMine && meId && (
        <div className="border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
          <button
            onClick={() =>
              router.push(
                `/dm/${group.author.id}?reply=1&draft=${encodeURIComponent(
                  `Re: your story${item.caption ? ` — "${item.caption.slice(0, 60)}"` : ""}`
                )}`
              )
            }
            className="w-full cursor-text rounded-full border border-white/25 px-4 py-2.5 text-left text-sm text-white/70 transition hover:border-white/50"
          >
            Reply to {group.author.name || "this story"}…
          </button>
        </div>
      )}
    </div>
  );
}

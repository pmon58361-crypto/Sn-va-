"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHighlight, deleteHighlight } from "@/app/highlights/actions";
import { cdnUrl } from "@/lib/cdn";

export type HighlightPreview = {
  id: string;
  title: string;
  coverUrl: string | null;
  items: { id: string; imageUrl: string }[];
};

const CIRCLE = "h-20 w-20";

// ── Thumbnail with graceful degradation ────────────────────────────────────
// coverUrl → first item image → letter-on-gradient. Dead Cloudinary/local
// URLs (destroyed assets, missing files) must never show a broken-image
// glyph — each <img> that fails advances the fallback chain.
function HighlightThumb({
  title,
  coverUrl,
  items,
}: {
  title: string;
  coverUrl: string | null;
  items: { id: string; imageUrl: string }[];
}) {
  const [stage, setStage] = useState(0);
  const src =
    stage === 0 ? coverUrl : stage === 1 ? (items[0]?.imageUrl ?? null) : null;
  // Never render a bare "?" — real first letter, else a folder glyph.
  const letter = (title ?? "").trim().charAt(0).toUpperCase();

  if (!src) {
    return (
      <span
        className={`grid ${CIRCLE} place-items-center rounded-full bg-gradient-to-tr from-accent to-like p-[3px]`}
      >
        <span className="grid h-full w-full place-items-center rounded-full bg-bg text-xl font-bold text-ink">
          {letter || "📁"}
        </span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={cdnUrl(src, 160)}
      alt=""
      onError={() => setStage((s) => s + 1)}
      className={`${CIRCLE} rounded-full border border-line object-cover`}
    />
  );
}

// Instagram-style highlights row: dashed "New" circle (owner) + one circle
// per highlight. Click a circle to view its photos; click New to build one.
export function Highlights({
  userId,
  isOwner,
  highlights,
}: {
  userId: string;
  isOwner: boolean;
  highlights: HighlightPreview[];
}) {
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<HighlightPreview | null>(null);

  return (
    <div className="border-b border-line py-5">
      <div className="flex items-start gap-4 overflow-x-auto pb-1">
        {isOwner && (
          <button
            onClick={() => setCreating(true)}
            className="flex w-[84px] shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={`grid ${CIRCLE} place-items-center rounded-full border-2 border-dashed border-line-strong text-2xl font-light text-ink-muted transition hover:border-accent hover:text-accent`}
            >
              +
            </span>
            <span className="w-full truncate text-center text-[13px] text-ink-secondary">
              New
            </span>
          </button>
        )}

        {highlights.map((h) => (
          <button
            key={h.id}
            onClick={() => setViewing(h)}
            className="flex w-[84px] shrink-0 flex-col items-center gap-1.5"
          >
            <HighlightThumb title={h.title} coverUrl={h.coverUrl} items={h.items} />
            <span className="w-full truncate text-center text-[13px] text-ink-secondary">
              {h.title || "Untitled"}
            </span>
          </button>
        ))}
      </div>

      {creating && (
        <CreateModal userId={userId} onClose={() => setCreating(false)} />
      )}
      {viewing && (
        <ViewModal highlight={viewing} isOwner={isOwner} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

// ── Create ──────────────────────────────────────────────────────────────────

function CreateModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList) {
    setError(null);
    try {
      const form = new FormData();
      for (const f of Array.from(files).slice(0, 10)) form.append("files", f);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUrls((prev) => [...prev, ...(data.urls as string[])] as typeof prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  function save() {
    startTransition(async () => {
      const res = await createHighlight({ title, imageUrls: urls });
      if (!res.ok) {
        setError(res.error || "Failed");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal onClose={onClose} label="New highlight">
      <h3 className="mb-4 text-xl font-extrabold">New highlight</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name it — e.g. Art, Travel, 2026"
        maxLength={40}
        className="input mb-3"
        autoFocus
      />

      {urls.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={u + i}
              src={u}
              alt=""
              className="h-20 w-20 rounded-lg border border-line object-cover"
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="btn-outline mb-3 w-full py-2 text-sm"
      >
        Add photos
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && <p className="mb-3 text-sm text-warm">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending || urls.length === 0 || !title.trim()}
          className="btn-primary px-5 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

// ── View / delete ───────────────────────────────────────────────────────────

function ViewModal({
  highlight,
  isOwner,
  onClose,
}: {
  highlight: HighlightPreview;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      await deleteHighlight(highlight.id);
      onClose();
      router.refresh();
    });
  }

  const count = highlight.items.length;

  return (
    <Modal onClose={onClose} wide label={highlight.title}>
      {/* Header: cover thumb + title + count, close always visible */}
      <div className="mb-4 flex items-center gap-3">
        <HighlightThumb
          title={highlight.title}
          coverUrl={highlight.coverUrl}
          items={highlight.items}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <h3 className="truncate text-xl font-extrabold">
            {highlight.title || "Untitled"}
          </h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            {count === 0
              ? "No photos yet"
              : count === 1
                ? "1 photo"
                : `${count} photos`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close highlight viewer"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none text-ink-faint transition hover:bg-soft hover:text-ink"
        >
          {"\u00D7"}
        </button>
      </div>
      {count === 0 ? (
        <p className="rounded-2xl bg-soft py-10 text-center text-sm text-ink-muted">
          No photos in this highlight yet.
        </p>
      ) : (
        <div
          className={`grid gap-2 overflow-y-auto ${
            count === 1
              ? "max-h-[65vh] grid-cols-1"
              : count <= 4
                ? "max-h-[65vh] grid-cols-2"
                : "max-h-[60vh] grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {highlight.items.map((it) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={it.id}
              src={cdnUrl(it.imageUrl, 640)}
              alt=""
              loading="lazy"
              className={`w-full rounded-2xl border border-line object-cover ${
                count === 1
                  ? "mx-auto max-h-[60vh] max-w-md object-contain"
                  : "aspect-square"
              }`}
            />
          ))}
        </div>
      )}
      {isOwner && (
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <button
            type="button"
            onClick={remove}
            onBlur={() => setConfirming(false)}
            disabled={pending}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              confirming
                ? "bg-warm font-semibold text-white"
                : "bg-warm-tint text-warm hover:bg-warm hover:text-white"
            }`}
          >
            {pending
              ? "Deleting…"
              : confirming
                ? "Tap again to confirm"
                : "Delete highlight"}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Shared shell ────────────────────────────────────────────────────────────

function Modal({
  children,
  onClose,
  wide = false,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  label?: string;
}) {
  // Esc closes — keyboard parity with the post lightbox.
  // Body scroll locks while open so the backdrop feels like a real viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={`w-full rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6 ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

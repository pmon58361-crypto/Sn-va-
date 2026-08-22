"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHighlight, deleteHighlight } from "@/app/highlights/actions";
import { cdnUrl } from "@/lib/cdn";

export type HighlightPreview = {
  id: string;
  title: string;
  coverUrl: string | null;
  items: { id: string; imageUrl: string }[];
};

const CIRCLE = "h-16 w-16 sm:h-[72px] sm:w-[72px]";

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
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={`grid ${CIRCLE} place-items-center rounded-full border-2 border-dashed border-line-strong text-2xl font-light text-ink-muted transition hover:border-accent hover:text-accent`}
            >
              +
            </span>
            <span className="w-full truncate text-center text-xs text-ink-secondary">
              New
            </span>
          </button>
        )}

        {highlights.map((h) => (
          <button
            key={h.id}
            onClick={() => setViewing(h)}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
          >
            {h.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cdnUrl(h.coverUrl, 160)}
                alt=""
                className={`${CIRCLE} rounded-full border border-line object-cover`}
              />
            ) : (
              <span className={`grid ${CIRCLE} place-items-center rounded-full bg-surface-hover text-lg font-bold`}>
                {h.title.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="w-full truncate text-center text-xs text-ink-secondary">
              {h.title}
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
    <Modal onClose={onClose}>
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
  const router = useRouter();

  function remove() {
    startTransition(async () => {
      await deleteHighlight(highlight.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-extrabold">{highlight.title}</h3>
        {isOwner && (
          <button
            onClick={remove}
            disabled={pending}
            className="text-xs font-medium text-warm hover:underline disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete highlight"}
          </button>
        )}
      </div>
      {highlight.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No photos.</p>
      ) : (
        <div className="grid max-h-[60vh] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4">
          {highlight.items.map((it) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={it.id}
              src={cdnUrl(it.imageUrl, 320)}
              alt=""
              loading="lazy"
              className="aspect-square w-full rounded-lg border border-line object-cover"
            />
          ))}
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
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4"
      onClick={onClose}
    >
      <div
        className={`card w-full bg-bg p-5 ${wide ? "max-w-lg" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

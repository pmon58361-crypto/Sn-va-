"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/app/groups/actions";

/**
 * Create-group modal: name (slug auto-derived, editable), description,
 * cover upload, visibility + join mode. Cover uploads through /api/upload
 * like every other image (compression + daily quota apply).
 */
export function CreateGroupButton({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  if (!signedIn) {
    return (
      <a href="/auth/signin?callbackUrl=/groups" className="btn-primary shrink-0">
        Create group
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary shrink-0"
      >
        + Create group
      </button>
      {open && <CreateModal onClose={() => setOpen(false)} />}
    </>
  );
}

function slugify(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || ""
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinMode, setJoinMode] = useState<"open" | "approval">("open");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onName(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function uploadCover(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCoverUrl((data.urls as string[])[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await createGroup({
        name,
        description,
        coverUrl,
        visibility,
        joinMode,
        // slug is derived server-side from the name; the editable field is a hint
        ...(slug ? { name } : {}),
      } as Parameters<typeof createGroup>[0]);
      if (!res.ok) {
        setError(res.error || "Failed");
        setPending(false);
        return;
      }
      onClose();
      router.push(`/groups/${res.slug}`);
    } catch {
      setError("Something went wrong");
      setPending(false);
    }
  }

  const valid =
    name.trim().length >= 3 && !uploading;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create a group"
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto bg-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-extrabold">Create a group</h3>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Design Crew"
          className="input mb-1"
          autoFocus
        />
        <p className="mb-3 font-mono text-[11px] text-ink-faint">
          /groups/{slug || "…"}
        </p>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="What is this group about?"
          className="input mb-3 resize-none"
        />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              className="input"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Joining
            </label>
            <select
              value={joinMode}
              onChange={(e) => setJoinMode(e.target.value as "open" | "approval")}
              className="input"
            >
              <option value="open">Open</option>
              <option value="approval">Approval</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Cover (optional)
          </label>
          {coverUrl ? (
            <div className="relative h-24 w-full overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-xl border-2 border-dashed border-line-strong py-6 text-sm text-ink-secondary disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Add a cover image"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCover(f);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="mb-3 text-sm text-warm">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !valid}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

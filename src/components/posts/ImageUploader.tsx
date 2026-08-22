"use client";

import { useCallback, useRef, useState } from "react";
import { UploadIcon, TrashIcon, PlusIcon } from "@/components/ui/Icons";
import { MAX_IMAGES_PER_POST, MAX_IMAGE_BYTES } from "@/lib/types";
import { cdnUrl } from "@/lib/cdn";

export type UploadedImage = { url: string; name: string };

/**
 * Image uploader with drag-and-drop, previews, and per-image removal.
 * Uploads to /api/upload. Enforces the per-post image cap client-side
 * (server enforces too). Compact: thumbnail strip first, dropzone only
 * while empty. `postId` binds uploads to an existing post (edit mode).
 */
export function ImageUploader({
  images,
  onChange,
  postId,
}: {
  images: UploadedImage[];
  onChange: (imgs: UploadedImage[]) => void;
  postId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_IMAGES_PER_POST - images.length;

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).slice(0, remaining);
      if (files.length === 0) return;

      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        if (postId) form.append("postId", postId);
        for (const f of files) {
          if (f.size > MAX_IMAGE_BYTES) {
            setError(`${f.name} exceeds 5MB and was skipped`);
            continue;
          }
          form.append("files", f);
        }
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }
        const data = (await res.json()) as { urls: string[]; errors?: string[] };
        const next: UploadedImage[] = data.urls.map((url, i) => ({
          url,
          name: files[i]?.name || "image",
        }));
        onChange([...images, ...next]);
        if (data.errors && data.errors.length) setError(data.errors.join("; "));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [images, onChange, postId, remaining]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const empty = images.length === 0;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Empty state — full dropzone */}
      {empty && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-7 text-center transition ${
            dragging
              ? "border-accent bg-accent-tint"
              : "border-line-strong hover:border-accent"
          }`}
        >
          <UploadIcon className="h-6 w-6 text-ink-faint" />
          <p className="mt-2 text-sm font-medium text-ink-soft">
            {uploading ? "Uploading…" : "Add images"}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Drag &amp; drop or click · JPG, PNG, WEBP, GIF · 5MB each
          </p>
        </div>
      )}

      {/* Non-empty — thumbnail strip + add tile */}
      {!empty && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div
                key={img.url + i}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cdnUrl(img.url, 200)}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  aria-label="Remove image"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={`grid h-20 w-20 place-items-center rounded-lg border border-dashed text-ink-faint transition hover:border-accent hover:text-accent disabled:opacity-50 ${
                  dragging ? "border-accent bg-accent-tint text-accent" : "border-line-strong"
                }`}
                aria-label="Add more images"
              >
                {uploading ? (
                  <span className="text-xs">…</span>
                ) : (
                  <PlusIcon className="h-5 w-5" />
                )}
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-ink-faint">
            {images.length}/{MAX_IMAGES_PER_POST} images
            {uploading ? " · uploading…" : " · drag more here to add"}
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-warm">{error}</p>}
    </div>
  );
}

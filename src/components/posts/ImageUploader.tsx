"use client";

import { useCallback, useRef, useState } from "react";
import { UploadIcon, TrashIcon, ImageIcon } from "@/components/ui/Icons";
import { MAX_IMAGES_PER_POST, MAX_IMAGE_BYTES } from "@/lib/types";

export type UploadedImage = { url: string; name: string };

/**
 * Image uploader with drag-and-drop, previews, and per-image removal.
 * Uploads to /api/upload. Enforces a 100-image cap client-side (server enforces too).
 *
 * `postId` is optional; pass it to bind uploads to an existing post (edit mode).
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
    const next = images.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-soft">
        Images <span className="text-ink-faint font-normal">({images.length}/{MAX_IMAGES_PER_POST})</span>
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging
            ? "border-accent bg-accent-tint"
            : "border-line-strong hover:border-zinc-400"
        }`}
      >
        <UploadIcon className="h-8 w-8 text-ink-faint" />
        <p className="mt-2 text-sm font-medium text-ink-soft">
          {uploading ? "Uploading…" : "Drag & drop or click to upload"}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">
          Up to {MAX_IMAGES_PER_POST} images · JPG, PNG, WEBP, GIF · 5MB each
        </p>
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
      </div>

      {error && (
        <p className="mt-2 text-xs text-accent">{error}</p>
      )}

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img, i) => (
            <div
              key={img.url + i}
              className="group relative aspect-square overflow-hidden rounded-lg border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(i);
                }}
                className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove image"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-ink-faint">
          <ImageIcon className="h-3.5 w-3.5" /> No images yet
        </p>
      )}
    </div>
  );
}

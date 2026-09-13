"use client";

import { useRef, useState } from "react";

// Storefront / license photo picker for the business claim form.
// Uploads immediately through /api/upload (purpose "business", counts
// toward the daily cap like every other photo) and stores the returned
// URL in the hidden proofImageUrl field the server action reads —
// one step for the claimant instead of upload-then-paste.
export function ProofPhotoPicker() {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file || uploading) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Pick an image under 5MB");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("files", file);
      form.append("purpose", "business");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[] };
      if (!res.ok || !data.urls?.[0]) throw new Error();
      setUrl(data.urls[0]);
    } catch {
      setError("Upload failed — try again");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <input type="hidden" name="proofImageUrl" value={url ?? ""} />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Proof photo preview"
            className="h-16 w-16 rounded-xl border border-line object-cover"
          />
          <button
            type="button"
            onClick={() => setUrl(null)}
            className="btn-outline px-3 py-1.5 text-xs"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="btn-outline inline-block cursor-pointer px-4 py-2 text-sm">
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => pick(e.target.files)}
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-warm">{error}</p>}
    </div>
  );
}

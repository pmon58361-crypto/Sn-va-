"use client";

// Client-side upload path: compress → signed direct-to-Cloudinary upload
// with XHR progress → ledger register. Falls back to the legacy proxied
// /api/upload POST when direct upload is unavailable (local dev without
// CLOUDINARY_URL, signing failure). The fallback records its own ledger
// row server-side, so both paths end claimed-by-URL the same way.

export const COMPRESS_MAX_EDGE = 1600;

/** Shrink photos to COMPRESS_MAX_EDGE in-browser (JPEG ~0.82). Skips GIFs
 *  (re-encoding kills animation) and files already small enough. Returns
 *  the original file when compression isn't possible — never throws. */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size < 300 * 1024) return file;
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[a-z0-9]+$/i, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export type DirectUploadResult = { url: string; publicId: string | null };

type SignResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/** Full direct path: compress → XHR to Cloudinary (per-file progress) →
 *  ledger register. Throws with a plainspoken message on failure so the
 *  caller can fall back to the legacy path or show an error. */
export async function uploadDirect(
  file: File,
  purpose: string,
  onProgress?: (pct: number) => void
): Promise<DirectUploadResult> {
  const compressed = await compressImage(file);

  const signRes = await fetch(`/api/uploads?purpose=${encodeURIComponent(purpose)}`);
  if (!signRes.ok) throw new Error("Upload signing failed");
  const sign = (await signRes.json()) as SignResponse;
  if (!sign.cloudName || !sign.signature) throw new Error("Upload signing failed");

  const uploaded = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`
      );
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
            resolve(data);
          } else {
            reject(new Error(data?.error?.message || "Upload failed"));
          }
        } catch {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      const form = new FormData();
      form.append("file", compressed);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("folder", sign.folder);
      form.append("signature", sign.signature);
      xhr.send(form);
    }
  );

  // Register the ledger row (quota-enforced server-side). The upload
  // already landed — if registration fails the row stays missing, which
  // the claim step tolerates (it matches zero rows).
  const regRes = await fetch("/api/uploads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      purpose,
    }),
  });
  if (!regRes.ok) {
    const data = await regRes.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || "Upload registration failed"
    );
  }
  onProgress?.(100);
  return { url: uploaded.secure_url, publicId: uploaded.public_id };
}

/** Legacy proxied path (local dev / direct unavailable). Records its own
 *  ledger row server-side. Single file; throws plainspoken on failure. */
export async function uploadLegacy(
  file: File,
  opts?: { kind?: string; purpose?: string }
): Promise<DirectUploadResult> {
  const form = new FormData();
  if (opts?.kind) form.append("kind", opts.kind);
  if (opts?.purpose) form.append("purpose", opts.purpose);
  form.append("files", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as {
    urls?: string[];
    errors?: string[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "Upload failed");
  if (data.errors?.length) throw new Error(data.errors.join("; "));
  const url = data.urls?.[0];
  if (!url) throw new Error("Upload failed");
  return { url, publicId: null };
}

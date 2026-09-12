"use client";

import { useRef, useState } from "react";
import { uploadDirect, uploadLegacy } from "@/lib/uploadClient";
import { cdnUrl } from "@/lib/cdn";

export type BeforeAfterSlot = { url: string; alt: string } | null;

/**
 * Before/after composer slots: labeled "Raw" and "Result" wells, each with
 * its own upload affordance and its own per-file progress bar (XHR — not
 * the dead spinner). Uploads go direct-to-Cloudinary (signed) with a
 * legacy proxied fallback; every upload lands in the ledger either way.
 * Posting is blocked until both slots hold an image AND both alt texts
 * are filled (server re-validates). × targets are 40px.
 */
export function BeforeAfterSlots({
  before,
  after,
  onChange,
}: {
  before: BeforeAfterSlot;
  after: BeforeAfterSlot;
  onChange: (next: { before: BeforeAfterSlot; after: BeforeAfterSlot }) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Slot
        label="Raw"
        hint="The untouched original"
        slot={before}
        onSlot={(s) => onChange({ before: s, after })}
      />
      <Slot
        label="Result"
        hint="The final piece"
        slot={after}
        onSlot={(s) => onChange({ before, after: s })}
      />
    </div>
  );
}

function Slot({
  label,
  hint,
  slot,
  onSlot,
}: {
  label: string;
  hint: string;
  slot: BeforeAfterSlot;
  onSlot: (s: BeforeAfterSlot) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      let result: { url: string };
      try {
        result = await uploadDirect(file, "post:before_after", setProgress);
      } catch {
        // Direct unavailable (local dev, signing/cors hiccup) — fall back
        // to the proxied route, which records its own ledger row.
        result = await uploadLegacy(file, { purpose: "post:before_after" });
        setProgress(100);
      }
      onSlot({ url: result.url, alt: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-sm font-bold text-ink">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        // Camera-first on phones (desktop ignores it). Single-file input
        // so the attribute actually takes effect on mobile browsers.
        capture="environment"
        onChange={(e) => {
          handleFile(e.target.files);
          e.target.value = "";
        }}
      />

      {!slot ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="mt-2 grid min-h-[120px] w-full place-items-center rounded-lg border border-dashed border-line-strong text-sm text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {progress !== null ? (
            <span className="w-3/4">
              <span className="mb-1 block text-xs">Uploading… {progress}%</span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-soft">
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </span>
          ) : (
            `Add ${label.toLowerCase()} photo`
          )}
        </button>
      ) : (
        <div className="mt-2">
          <div className="relative overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cdnUrl(slot.url, 640)}
              alt={slot.alt || `${label} preview`}
              className="max-h-48 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onSlot(null)}
              aria-label={`Replace ${label.toLowerCase()} photo`}
              title={`Replace ${label.toLowerCase()} photo`}
              className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-lg text-white transition hover:bg-black/80"
            >
              ×
            </button>
          </div>
          {progress !== null && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-soft">
              <span
                className="block h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </span>
          )}
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">
              Alt text for screen readers (required)
            </span>
            <input
              value={slot.alt}
              onChange={(e) => onSlot({ ...slot, alt: e.target.value })}
              maxLength={200}
              placeholder={`Describe the ${label.toLowerCase()} image…`}
              className="input py-2 text-base sm:text-sm"
            />
          </label>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-warm">{error}</p>}
    </div>
  );
}

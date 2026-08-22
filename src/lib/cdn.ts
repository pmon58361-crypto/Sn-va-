// Cloudinary delivery helpers.
//
// Stored URLs are plain secure_urls. For rendering we inject Cloudinary's
// "auto" transformations so the CDN serves WebP/AVIF at the size actually
// displayed instead of full-res originals — this is what keeps the free
// tier's bandwidth bill near zero.

const UPLOAD_MARKER = "/image/upload/";

/**
 * Insert `f_auto,q_auto,w_<width>` into a Cloudinary image URL.
 * Non-Cloudinary URLs (OAuth avatars, local dev /uploads) pass through
 * untouched, so this is safe to wrap around any image src.
 */
export function cdnUrl(url: string | null | undefined, width = 960): string {
  if (!url) return "";
  const i = url.indexOf(UPLOAD_MARKER);
  if (i === -1) return url;

  const tail = url.slice(i + UPLOAD_MARKER.length);
  // Never stack transformations on an already-transformed URL.
  if (/^(f_auto|q_auto|w_\d+)/.test(tail)) return url;

  return (
    url.slice(0, i + UPLOAD_MARKER.length) +
    `f_auto,q_auto,w_${width}/` +
    tail
  );
}

/**
 * Derive a Cloudinary public_id from a stored secure_url.
 * Handles both raw (`.../upload/v1699/foo/bar.jpg`) and transformed
 * (`.../upload/f_auto,q_auto,w_640/v1699/foo.jpg`) shapes.
 * Works retroactively for every existing row — no publicId column needed.
 */
export function cloudinaryPublicId(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const i = url.indexOf(UPLOAD_MARKER);
  if (i === -1) return null;

  let tail = url.slice(i + UPLOAD_MARKER.length);

  // Skip any transformation segments up to the version segment.
  const vMatch = tail.match(/\/v\d+\//);
  if (vMatch && vMatch.index !== undefined) {
    tail = tail.slice(vMatch.index + vMatch[0].length);
  } else if (/^v\d+\//.test(tail)) {
    tail = tail.slice(tail.indexOf("/") + 1);
  }

  const dot = tail.lastIndexOf(".");
  if (dot !== -1) tail = tail.slice(0, dot);

  return tail || null;
}

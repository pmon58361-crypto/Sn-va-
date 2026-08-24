import { cloudinary } from "@/lib/cloudinary";
import { cloudinaryPublicId } from "@/lib/cdn";

/**
 * Incoming transformation baked into every stored asset: caps dimensions and
 * normalizes quality/format at INGEST time. Cheapest-credits approach — the
 * stored original itself is small (one asset, no per-size derived storage);
 * delivery-time cdnUrl() still adds responsive width variants on top.
 */
export function incomingTransform(maxEdge = 1600) {
  return [
    { width: maxEdge, height: maxEdge, crop: "limit" as const },
    { quality: "auto:good" as const, fetch_format: "auto" as const },
  ];
}

/**
 * Best-effort deletion of Cloudinary assets. The database is the source of
 * truth — if asset cleanup fails we log and move on rather than fail the
 * user-facing action (a leaked image costs bytes; a failed delete breaks UX).
 *
 * Derives public_ids from stored URLs, so it also cleans up rows created
 * before this module existed.
 */
export async function destroyAssets(
  urls: (string | null | undefined)[]
): Promise<void> {
  if (!process.env.CLOUDINARY_URL) return;

  const ids = Array.from(
    new Set(
      urls
        .map(cloudinaryPublicId)
        .filter((id): id is string => !!id)
    )
  );
  if (ids.length === 0) return;

  // delete_resources accepts up to 100 ids per call.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      await cloudinary.api.delete_resources(chunk);
    } catch (err) {
      console.error("[storage] delete_resources failed:", err);
    }
  }
}

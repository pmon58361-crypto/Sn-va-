import { cloudinary } from "@/lib/cloudinary";
import { cloudinaryPublicId } from "@/lib/cdn";

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

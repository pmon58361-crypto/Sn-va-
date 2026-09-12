import { prisma } from "@/lib/prisma";

// Upload-ledger write path (server only). Every stored asset gets a row at
// upload time; the create action that references its URL claims it.
// The sweeper is explicitly deferred — unclaimed rows are just rows for now.
//
// Claim matching is by (uploaderId, url) and NON-exclusive: surfaces that
// legitimately share URLs (highlights reuse story/post URLs) each claim
// without disturbing each other.

export type UploadPurpose =
  | "post"
  | "post:before_after"
  | "story"
  | "dm"
  | "group_chat"
  | "avatar"
  | "group_avatar"
  | "group_cover"
  | "highlight"
  | "ad";

/** Record one stored asset. Throws on DB failure — upload sites that call
 *  this inline (stories, ads) surface it as an upload error; the proxied
 *  /api/upload route converts it to a per-file error. */
export async function recordUpload(input: {
  url: string;
  publicId: string | null;
  uploaderId: string;
  purpose?: UploadPurpose;
}): Promise<void> {
  await prisma.upload.create({
    data: {
      url: input.url,
      publicId: input.publicId,
      uploaderId: input.uploaderId,
      purpose: input.purpose ?? "post",
    },
  });
}

/** Claim URLs referenced by a create/update action. Finalizes the purpose
 *  and stamps claimedAt. Best-effort BY DESIGN: posting must never fail
 *  because the ledger is down — an unclaimed row simply looks orphaned
 *  (the safe direction) until the sweeper exists. Legacy pre-ledger URLs
 *  match zero rows and are ignored. */
export async function claimUploads(
  uploaderId: string,
  urls: (string | null | undefined)[],
  purpose: UploadPurpose
): Promise<void> {
  const clean = Array.from(new Set(urls.filter((u): u is string => !!u)));
  if (clean.length === 0) return;
  try {
    await prisma.upload.updateMany({
      where: { uploaderId, url: { in: clean }, claimedAt: null },
      data: { claimedAt: new Date(), purpose },
    });
  } catch (err) {
    console.error("[uploads] claim failed (non-fatal):", err);
  }
}

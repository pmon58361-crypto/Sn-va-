"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser, requireUserId } from "@/lib/session";
import { assertClean } from "@/lib/filter";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { destroyAssets } from "@/lib/storage";
import type { UploadApiResponse } from "cloudinary";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/types";

const STORY_TTL_HOURS = 24;

// Create a story: either an image (uploaded to Cloudinary) or a text-only
// story with a background color. Expires 24h after creation.
export async function createStory(
  form: FormData
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const caption = (form.get("caption") as string | null)?.trim() || null;
  const bg = (form.get("bg") as string | null)?.trim() || null;
  const file = form.get("file");

  let imageUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { ok: false, error: "Unsupported image type" };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Image exceeds 5MB" };
    }
    if (!process.env.CLOUDINARY_URL) {
      return { ok: false, error: "Image storage not configured" };
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await new Promise<UploadApiResponse>((resolve: (r: UploadApiResponse) => void, reject: (e: Error) => void) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "snivat/stories", resource_type: "image" },
          (err, result) => {
            if (err || !result) reject(err ?? new Error("upload failed"));
            else resolve(result);
          }
        );
        stream.end(buffer);
      });
      imageUrl = res.secure_url;
    } catch (err) {
      console.error("[createStory] upload failed:", err);
      return { ok: false, error: "Upload failed" };
    }
  }

  if (!imageUrl && !caption) {
    return { ok: false, error: "Add an image or a caption" };
  }
  try {
    assertClean(caption, "Caption");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Blocked" };
  }

  await prisma.story.create({
    data: {
      authorId: me,
      imageUrl,
      caption,
      bg: bg && /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : "#1d9bf0",
      expiresAt: new Date(Date.now() + STORY_TTL_HOURS * 3600 * 1000),
    },
  });

  // Opportunistic storage reclaim — no cron at this scale. Bounded sweep;
  // never blocks or fails the user's own story.
  await reclaimExpiredStories().catch(() => {});

  revalidatePath("/community");
  return { ok: true };
}

// Expired stories stay visible in the author's Archive for a week, then this
// sweep hard-deletes the rows and frees their Cloudinary assets (free-tier
// storage survival). Bounded to 50 rows per run; errors are swallowed.
const ARCHIVE_RETENTION_MS = 7 * 86_400_000;

async function reclaimExpiredStories(): Promise<void> {
  const cutoff = new Date(Date.now() - STORY_TTL_HOURS * 3_600_000 - ARCHIVE_RETENTION_MS);
  const expired = await prisma.story.findMany({
    where: { expiresAt: { lt: cutoff }, imageUrl: { not: null } },
    select: { id: true, imageUrl: true },
    orderBy: { expiresAt: "asc" },
    take: 50,
  });
  if (!expired.length) return;
  await prisma.story.deleteMany({
    where: { id: { in: expired.map((e) => e.id) } },
  });
  await destroyAssets(
    expired.map((e) => e.imageUrl).filter((u): u is string => !!u)
  );
}

// Mark a story viewed (drives seen/unseen rings).
export async function viewStory(storyId: string) {
  const me = await requireUserId(); // fires per story tap — keep it cheap

  await prisma.storyView.upsert({
    where: {
      storyId_userId: { storyId, userId: me },
    },
    update: {},
    create: { storyId, userId: me },
  });
}

// Delete my own story immediately.
export async function deleteStory(storyId: string) {
  const me = (await requireActiveUser()).id;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true, imageUrl: true },
  });
  if (!story || story.authorId !== me) throw new Error("Forbidden");

  await prisma.story.delete({ where: { id: storyId } });
  // Story photos are only referenced by the story row — free the upload.
  if (story.imageUrl) await destroyAssets([story.imageUrl]);
  revalidatePath("/community");
}



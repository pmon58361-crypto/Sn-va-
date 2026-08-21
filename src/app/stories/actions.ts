"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/types";

const STORY_TTL_HOURS = 24;

// Create a story: either an image (uploaded to Cloudinary) or a text-only
// story with a background color. Expires 24h after creation.
export async function createStory(
  form: FormData
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;

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

  await prisma.story.create({
    data: {
      authorId: me,
      imageUrl,
      caption,
      bg: bg && /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : "#1d9bf0",
      expiresAt: new Date(Date.now() + STORY_TTL_HOURS * 3600 * 1000),
    },
  });

  revalidatePath("/community");
  return { ok: true };
}

// Mark a story viewed (drives seen/unseen rings).
export async function viewStory(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.storyView.upsert({
    where: {
      storyId_userId: { storyId, userId: session.user.id },
    },
    update: {},
    create: { storyId, userId: session.user.id },
  });
}

// Delete my own story immediately.
export async function deleteStory(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true },
  });
  if (!story || story.authorId !== session.user.id) throw new Error("Forbidden");

  await prisma.story.delete({ where: { id: storyId } });
  revalidatePath("/community");
}



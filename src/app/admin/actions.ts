"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { destroyAssets } from "@/lib/storage";
import { cloudinary } from "@/lib/cloudinary";
import { assertClean } from "@/lib/filter";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/types";
import type { UploadApiResponse } from "cloudinary";

export type AdminTargetType = "POST" | "COMMENT" | "MESSAGE" | "STORY";

function revalidateFeeds() {
  revalidatePath("/");
  revalidatePath("/community");
  revalidatePath("/jobs");
  revalidatePath("/applications");
  revalidatePath("/people");
  revalidatePath("/admin");
}

/**
 * Moderator says the reported content is fine: dismiss its open reports and
 * restore visibility (un-hides posts that were auto-hidden).
 */
export async function dismissReports(
  targetType: AdminTargetType,
  targetId: string
): Promise<{ ok: boolean }> {
  const admin = await requireAdmin();

  await prisma.report.updateMany({
    where: { status: "open", [fkFor(targetType)]: targetId },
    data: { status: "dismissed", moderatorId: admin.id },
  });

  if (targetType === "POST") {
    await prisma.post.updateMany({
      where: { id: targetId, hidden: true },
      data: { hidden: false },
    });
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      select: { category: true },
    });
    if (post) revalidatePath(sectionPath(post.category));
  }

  revalidateFeeds();
  return { ok: true };
}

/** Hide a post / delete a comment, message or story. Reports → actioned. */
export async function removeTarget(
  targetType: AdminTargetType,
  targetId: string
): Promise<{ ok: boolean }> {
  const admin = await requireAdmin();

  await prisma.report.updateMany({
    where: { status: "open", [fkFor(targetType)]: targetId },
    data: { status: "actioned", moderatorId: admin.id },
  });

  if (targetType === "POST") {
    await prisma.post.update({ where: { id: targetId }, data: { hidden: true } });
  } else if (targetType === "COMMENT") {
    await prisma.comment.delete({ where: { id: targetId } }).catch(() => {});
  } else if (targetType === "MESSAGE") {
    await prisma.message.delete({ where: { id: targetId } }).catch(() => {});
  } else if (targetType === "STORY") {
    const story = await prisma.story.findUnique({
      where: { id: targetId },
      select: { imageUrl: true },
    });
    await prisma.story.delete({ where: { id: targetId } }).catch(() => {});
    // Story photos live only behind the story row — free the upload.
    if (story?.imageUrl) await destroyAssets([story.imageUrl]);
  }

  revalidateFeeds();
  return { ok: true };
}

/** Hard-delete a post (spam removal). Frees its Cloudinary assets too. */
export async function deletePostPermanently(postId: string): Promise<{ ok: boolean }> {
  await requireAdmin();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { images: { select: { url: true } }, category: true },
  });
  if (!post) throw new Error("Not found");

  await prisma.post.delete({ where: { id: postId } });
  await destroyAssets(post.images.map((i) => i.url));
  revalidatePath(sectionPath(post.category));
  revalidateFeeds();
  return { ok: true };
}

/** Ban = writes blocked + sign-in refused. Content stays for review. */
export async function banUser(userId: string): Promise<{ ok: boolean; banned: boolean }> {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("You cannot ban yourself");
  if ((await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === "admin") {
    throw new Error("You cannot ban another admin");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: new Date() },
  });
  revalidateFeeds();
  return { ok: true, banned: true };
}

export async function unbanUser(userId: string): Promise<{ ok: boolean; banned: boolean }> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: null },
  });
  revalidateFeeds();
  return { ok: true, banned: false };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fkFor(targetType: AdminTargetType): string {
  switch (targetType) {
    case "POST":
      return "postId";
    case "COMMENT":
      return "commentId";
    case "MESSAGE":
      return "messageId";
    case "STORY":
      return "storyId";
    default:
      throw new Error("Invalid target type");
  }
}

function sectionPath(category: string): string {
  const map: Record<string, string> = {
    COMMUNITY: "/community",
    JOB_OFFER: "/jobs",
    JOB_REQUEST: "/jobs",
    JOB_LISTING: "/applications",
  };
  return map[category] || "/community";
}

// ── ads ──────────────────────────────────────────────────────────────────────

export type AdInput = {
  advertiser: string;
  headline: string;
  targetUrl: string;
  placement: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type SerializedAd = {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
  placement: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
};

function serializeAd(ad: {
  id: string;
  advertiser: string;
  headline: string;
  imageUrl: string | null;
  targetUrl: string;
  placement: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  impressions: number;
  clicks: number;
}): SerializedAd {
  return {
    ...ad,
    startsAt: ad.startsAt ? ad.startsAt.toISOString() : null,
    endsAt: ad.endsAt ? ad.endsAt.toISOString() : null,
  };
}

function parseAdForm(form: FormData): AdInput {
  const advertiser = String(form.get("advertiser") || "").trim();
  const headline = String(form.get("headline") || "").trim();
  const targetUrl = String(form.get("targetUrl") || "").trim();
  const placement = String(form.get("placement") || "").trim().toUpperCase();
  const startsAt = String(form.get("startsAt") || "").trim();
  const endsAt = String(form.get("endsAt") || "").trim();

  if (!advertiser || !headline) throw new Error("Advertiser and headline are required.");
  if (headline.length > 200) throw new Error("Headline must be 200 characters or fewer.");
  assertClean(headline, "Ad headline");
  assertClean(advertiser, "Advertiser name");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error("Target URL must be a valid absolute URL.");
  }
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Target URL must be https:// — javascript:/data: are not allowed.");
  }
  if (placement !== "FEED" && placement !== "SIDEBAR") {
    throw new Error("Placement must be FEED or SIDEBAR.");
  }

  return {
    advertiser,
    headline,
    targetUrl,
    placement,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
  };
}

async function storeAdImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Unsupported image type (${file.type}).`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 5MB limit.");
  }
  if (!process.env.CLOUDINARY_URL) {
    throw new Error(
      "Cloudinary is not configured on this deployment, so image uploads are unavailable."
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const res = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "snivat/ads", resource_type: "image" },
      (err, result) => {
        if (err || !result) reject(err ?? new Error("upload failed"));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
  return res.secure_url;
}

function dateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function createAd(
  form: FormData
): Promise<{ ok: boolean; error?: string; ad?: SerializedAd }> {
  await requireAdmin();
  try {
    const input = parseAdForm(form);
    const image = form.get("image");
    const imageUrl =
      image instanceof File && image.size > 0 ? await storeAdImage(image) : null;

    const ad = await prisma.ad.create({
      data: {
        advertiser: input.advertiser,
        headline: input.headline,
        targetUrl: input.targetUrl,
        placement: input.placement,
        imageUrl,
        startsAt: dateOrNull(input.startsAt),
        endsAt: dateOrNull(input.endsAt),
      },
    });
    revalidatePath("/admin/ads");
    revalidatePath("/community");
    return { ok: true, ad: serializeAd(ad) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Create failed" };
  }
}

export async function updateAd(
  id: string,
  form: FormData
): Promise<{ ok: boolean; error?: string; ad?: SerializedAd }> {
  await requireAdmin();
  try {
    const input = parseAdForm(form);
    const existing = await prisma.ad.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
    if (!existing) throw new Error("Ad not found");

    const image = form.get("image");
    let imageUrl: string | undefined; // undefined = keep current
    if (image instanceof File && image.size > 0) {
      imageUrl = await storeAdImage(image);
      // Replace asset only when nothing else references the old one.
      if (existing.imageUrl) {
        const shared = await prisma.ad.count({
          where: { imageUrl: existing.imageUrl, id: { not: id } },
        });
        if (shared === 0) {
          destroyAssets([existing.imageUrl]).catch(() => {});
        }
      }
    }

    const ad = await prisma.ad.update({
      where: { id },
      data: {
        advertiser: input.advertiser,
        headline: input.headline,
        targetUrl: input.targetUrl,
        placement: input.placement,
        startsAt: dateOrNull(input.startsAt),
        endsAt: dateOrNull(input.endsAt),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      },
    });
    revalidatePath("/admin/ads");
    revalidatePath("/community");
    return { ok: true, ad: serializeAd(ad) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function setAdActive(
  id: string,
  active: boolean
): Promise<{ ok: boolean }> {
  await requireAdmin();
  await prisma.ad.update({ where: { id }, data: { active } });
  revalidatePath("/admin/ads");
  revalidatePath("/community");
  return { ok: true };
}

export async function deleteAd(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const ad = await prisma.ad.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  await prisma.ad.delete({ where: { id } });
  if (ad?.imageUrl) {
    const shared = await prisma.ad.count({
      where: { imageUrl: ad.imageUrl },
    });
    if (shared === 0) {
      destroyAssets([ad.imageUrl]).catch(() => {});
    }
  }
  revalidatePath("/admin/ads");
  revalidatePath("/community");
  return { ok: true };
}

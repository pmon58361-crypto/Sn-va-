"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { destroyAssets } from "@/lib/storage";

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

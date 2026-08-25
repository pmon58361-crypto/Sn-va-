"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { assertClean } from "@/lib/filter";
import { destroyAssets } from "@/lib/storage";
import { slugifyName, uniqueSlug } from "@/lib/groups";

const VISIBILITIES = ["public", "private"];
const JOIN_MODES = ["open", "approval"];

// Create a group — creator becomes the owner member atomically.
export async function createGroup(input: {
  name: string;
  description?: string;
  coverUrl?: string;
  visibility?: string;
  joinMode?: string;
}): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const me = (await requireActiveUser()).id;

  const name = input.name?.trim() || "";
  if (name.length < 3 || name.length > 60) {
    return { ok: false, error: "Group name must be 3–60 characters" };
  }
  try {
    assertClean(name, "Group name");
    if (input.description) assertClean(input.description, "Description");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Blocked" };
  }

  const visibility = VISIBILITIES.includes(input.visibility || "")
    ? input.visibility!
    : "public";
  const joinMode = JOIN_MODES.includes(input.joinMode || "")
    ? input.joinMode!
    : "open";
  const coverUrl = input.coverUrl?.trim() || null;
  const description = input.description?.trim()?.slice(0, 500) || null;

  const slug = await uniqueSlug(slugifyName(name));

  const group = await prisma.group.create({
    data: {
      name,
      slug,
      description,
      coverUrl,
      visibility,
      joinMode,
      creatorId: me,
      members: { create: { userId: me, role: "owner" } },
    },
  });

  revalidatePath("/groups");
  return { ok: true, slug: group.slug };
}

export async function joinGroup(
  groupId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, joinMode: true, visibility: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  if (group.visibility !== "public") {
    return { ok: false, error: "This group is private" };
  }
  if (group.joinMode !== "open") {
    return { ok: false, error: "Membership requires owner approval — DM them." };
  }

  // idempotent join
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId: me } },
    update: {},
    create: { groupId, userId: me, role: "member" },
  });
  revalidatePath(`/groups`);
  return { ok: true };
}

export async function leaveGroup(
  groupId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: me } },
  });
  if (!membership) return { ok: false, error: "You are not a member" };
  if (membership.role === "owner") {
    return {
      ok: false,
      error: "Owners can't leave — delete the group instead.",
    };
  }
  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: me } },
  });
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Owner (or admin) removes a non-owner member. */
export async function kickMember(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const actor = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: me } },
  });
  const isAdmin = (await prisma.user.findUnique({
    where: { id: me },
    select: { role: true },
  }))?.role === "admin";

  if (!actor && !isAdmin) return { ok: false, error: "Forbidden" };

  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!target) return { ok: false, error: "Not a member" };
  if (target.role === "owner") {
    return { ok: false, error: "The owner can't be kicked" };
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
  revalidatePath("/groups");
  return { ok: true };
}

/** Owner (or admin) deletes the group. Posts cascade; their image assets are
 *  best-effort destroyed first so nothing leaks against storage quota. */
export async function deleteGroup(
  groupId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true, coverUrl: true },
  });
  if (!group) return { ok: false, error: "Group not found" };

  const isAdmin =
    (
      await prisma.user.findUnique({ where: { id: me }, select: { role: true } })
    )?.role === "admin";
  if (group.creatorId !== me && !isAdmin) {
    return { ok: false, error: "Only the owner can delete this group" };
  }

  const posts = await prisma.post.findMany({
    where: { groupId },
    select: { images: { select: { url: true } } },
  });
  await destroyAssets([
    group.coverUrl,
    ...posts.flatMap((p) => p.images.map((i) => i.url)),
  ]);

  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath("/groups");
  return { ok: true };
}

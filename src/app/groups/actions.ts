"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { assertClean } from "@/lib/filter";
import { destroyAssets } from "@/lib/storage";
import { claimUploads } from "@/lib/uploads";
import { slugifyName, uniqueSlug } from "@/lib/groups";
import { normalizeCategory } from "@/lib/group-categories";

const VISIBILITIES = ["public", "private"];
const JOIN_MODES = ["open", "approval"];

// Create a group — creator becomes the owner member atomically.
export async function createGroup(input: {
  name: string;
  description?: string;
  coverUrl?: string;
  visibility?: string;
  joinMode?: string;
  category?: string;
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
  const category = normalizeCategory(input.category);

  const slug = await uniqueSlug(slugifyName(name));

  const group = await prisma.group.create({
    data: {
      name,
      slug,
      description,
      coverUrl,
      category,
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

/** Owner (or moderator/admin) removes a member. Owners may kick anyone
 *  except themselves; moderators may kick plain members only. */
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
  if (actor && actor.role !== "owner" && actor.role !== "moderator" && !isAdmin) {
    return { ok: false, error: "Only owners and moderators can remove members" };
  }

  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!target) return { ok: false, error: "Not a member" };
  if (target.role === "owner") {
    return { ok: false, error: "The owner can't be kicked" };
  }
  if (target.role === "moderator" && actor?.role !== "owner" && !isAdmin) {
    return { ok: false, error: "Only the owner can remove a moderator" };
  }
  if (userId === me) return { ok: false, error: "Leave the group instead" };

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
  revalidatePath("/groups");
  return { ok: true };
}

/** Owner (or admin) deletes the group. Posts survive (SetNull unscope to
 *  the community feed), so only the cover asset is destroyed — never post
 *  images, which keep rendering on the surviving posts. */
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

  await destroyAssets([group.coverUrl]);

  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath("/groups");
  return { ok: true };
}

// ── Join requests + moderation ───────────────────────────────────────────
// Replaces the "DM the owner" dead-end: approval and private groups take
// tracked requests; owners and moderators approve from the roster.

async function isSiteAdmin(userId: string): Promise<boolean> {
  return (
    (
      await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    )?.role === "admin"
  );
}

/** True when the caller may approve requests and kick members. */
async function canModerate(
  groupId: string,
  me: string
): Promise<{ ok: boolean; role: string | null }> {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: me } },
    select: { role: true },
  });
  if (!m) {
    return { ok: (await isSiteAdmin(me)) ? true : false, role: null };
  }
  if (m.role === "owner" || m.role === "moderator") return { ok: true, role: m.role };
  return { ok: (await isSiteAdmin(me)) ? true : false, role: m.role };
}

/** Ask to join an approval/private group. Idempotent; open groups should
 *  use Join instead. Members can't request. */
export async function requestJoin(
  groupId: string,
  message?: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, joinMode: true, visibility: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  // Open PUBLIC groups join instantly — requesting is pointless. Anything
  // else (approval, or private of any join mode) goes through requests.
  if (group.joinMode === "open" && group.visibility === "public") {
    return { ok: false, error: "This group is open — just hit Join" };
  }
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: me } },
  });
  if (existing) return { ok: false, error: "You're already a member" };

  const note = message?.trim().slice(0, 200) || null;
  await prisma.groupJoinRequest.upsert({
    where: { groupId_userId: { groupId, userId: me } },
    update: { message: note },
    create: { groupId, userId: me, message: note },
  });
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Withdraw my own pending request. */
export async function cancelRequest(
  groupId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;
  await prisma.groupJoinRequest
    .delete({ where: { groupId_userId: { groupId, userId: me } } })
    .catch(() => null);
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Approve a request: membership + request cleanup, atomically. */
export async function approveRequest(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;
  const mod = await canModerate(groupId, me);
  if (!mod.ok) return { ok: false, error: "Forbidden" };

  const req = await prisma.groupJoinRequest.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!req) return { ok: false, error: "Request not found" };

  await prisma.$transaction([
    prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId, role: "member" },
    }),
    prisma.groupJoinRequest.delete({
      where: { groupId_userId: { groupId, userId } },
    }),
  ]);
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Decline a request (no history kept — they may ask again). */
export async function declineRequest(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;
  const mod = await canModerate(groupId, me);
  if (!mod.ok) return { ok: false, error: "Forbidden" };

  await prisma.groupJoinRequest
    .delete({ where: { groupId_userId: { groupId, userId } } })
    .catch(() => null);
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Owner promotes a member to moderator. */
export async function promoteMember(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  const admin = await isSiteAdmin(me);
  if (group.creatorId !== me && !admin) {
    return { ok: false, error: "Only the owner can promote moderators" };
  }
  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!target || target.role !== "member") {
    return { ok: false, error: "Only members can be promoted" };
  }
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { role: "moderator" },
  });
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Owner demotes a moderator (moderators may also step down themselves). */
export async function demoteMember(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  const admin = await isSiteAdmin(me);
  const selfStepDown = userId === me;
  if (group.creatorId !== me && !admin && !selfStepDown) {
    return { ok: false, error: "Only the owner can demote moderators" };
  }
  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!target || target.role !== "moderator") {
    return { ok: false, error: "Not a moderator" };
  }
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { role: "member" },
  });
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Owner hands the crown to a member/moderator (atomic swap). The previous
 *  owner becomes a plain member and may leave normally afterwards. */
export async function transferOwnership(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;
  if (userId === me) return { ok: false, error: "You already own this group" };

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  // Creator row is the source of truth for ownership (role mirrors it).
  if (group.creatorId !== me) {
    return { ok: false, error: "Only the owner can transfer ownership" };
  }
  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!target) return { ok: false, error: "They're not a member" };

  await prisma.$transaction([
    prisma.group.update({ where: { id: groupId }, data: { creatorId: userId } }),
    prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role: "owner" },
    }),
    prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: me } },
      data: { role: "member" },
    }),
  ]);
  revalidatePath(`/groups`);
  return { ok: true };
}

// ── Showcase: rules + pinned highlights ──────────────────────────────────

/** Owner rewrites the house rules (one per line, shown on the group page). */
export async function updateGroupRules(
  groupId: string,
  rules: string
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  if (group.creatorId !== me && !(await isSiteAdmin(me))) {
    return { ok: false, error: "Only the owner can edit the rules" };
  }
  const clean = rules.trim().slice(0, 2000) || null;
  if (clean) {
    try {
      assertClean(clean, "Rules");
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Blocked" };
    }
  }
  await prisma.group.update({ where: { id: groupId }, data: { rules: clean } });
  revalidatePath(`/groups`);
  return { ok: true };
}

/** Pin or unpin a group post into the highlights row (owner/moderator). */
export async function setPostPinned(
  groupId: string,
  postId: string,
  pinned: boolean
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;
  const mod = await canModerate(groupId, me);
  if (!mod.ok) return { ok: false, error: "Forbidden" };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { groupId: true },
  });
  if (!post || post.groupId !== groupId) {
    return { ok: false, error: "That post isn't in this group" };
  }
  await prisma.post.update({ where: { id: postId }, data: { isPinned: pinned } });
  revalidatePath(`/groups`);
  return { ok: true };
}

// Owner cover change/remove. Accepts a fresh /api/upload URL or null
// (null = back to the gradient-letter tile). Old asset destroyed when
// nothing else references it.
export async function updateGroupCover(
  groupId: string,
  coverUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true, coverUrl: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  if (group.creatorId !== me) {
    return { ok: false, error: "Only the owner can change the cover" };
  }

  const next = coverUrl?.trim() || null;
  if (next && !next.startsWith("https://") && !next.startsWith("/uploads/")) {
    return { ok: false, error: "Invalid image" };
  }

  await prisma.group.update({ where: { id: groupId }, data: { coverUrl: next } });
  await claimUploads(me, [next], "group_cover");
  if (group.coverUrl && group.coverUrl !== next) {
    const shared = await prisma.group.count({
      where: { coverUrl: group.coverUrl, id: { not: groupId } },
    });
    if (shared === 0) destroyAssets([group.coverUrl]).catch(() => {});
  }
  revalidatePath("/groups");
  return { ok: true };
}

// Owner avatar change/remove — the square icon, independent from the banner
// cover. Accepts a fresh /api/upload URL or null (null = back to the auto
// letter tile; GroupCard then falls back to a cover crop). Same ownership
// and orphan-asset rules as the cover.
export async function updateGroupAvatar(
  groupId: string,
  avatarUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  const me = (await requireActiveUser()).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true, avatarUrl: true },
  });
  if (!group) return { ok: false, error: "Group not found" };
  if (group.creatorId !== me) {
    return { ok: false, error: "Only the owner can change the avatar" };
  }

  const next = avatarUrl?.trim() || null;
  if (next && !next.startsWith("https://") && !next.startsWith("/uploads/")) {
    return { ok: false, error: "Invalid image" };
  }

  await prisma.group.update({ where: { id: groupId }, data: { avatarUrl: next } });
  await claimUploads(me, [next], "group_avatar");
  if (group.avatarUrl && group.avatarUrl !== next) {
    const shared = await prisma.group.count({
      where: { avatarUrl: group.avatarUrl, id: { not: groupId } },
    });
    if (shared === 0) destroyAssets([group.avatarUrl]).catch(() => {});
  }
  revalidatePath("/groups");
  return { ok: true };
}

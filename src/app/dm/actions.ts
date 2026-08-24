"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { requireActiveUser, requireUserId } from "@/lib/session";
import { assertClean } from "@/lib/filter";
import { newAccountOverLimit, newAccountLimitMessage } from "@/lib/limits";

// Send a direct message. Creates the message and clears read state on the
// recipient's side naturally (their unread count is computed per-thread).
export async function sendMessage(recipientId: string, content: string) {
  const me = await requireActiveUser();

  if (me.id === recipientId) throw new Error("Cannot message yourself");
  if (!content.trim()) throw new Error("Message required");
  if (content.length > 2000) throw new Error("Message too long");
  assertClean(content, "Message");

  const lim = await newAccountOverLimit(me.id, me.createdAt, "dm");
  if (lim.limited) throw new Error(newAccountLimitMessage("dm", lim.cap));

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) throw new Error("User not found");

  const msg = await prisma.message.create({
    data: {
      senderId: me.id,
      recipientId,
      content: content.trim(),
    },
  });

  await createNotification({
    userId: recipientId,
    actorId: me.id,
    type: "message",
  });

  revalidatePath("/dm");
  revalidatePath(`/dm/${recipientId}`);
  return { id: msg.id, createdAt: msg.createdAt.toISOString() };
}

// Mark every unread message in a thread (from `otherUserId` to me) as read.
export async function markThreadRead(otherUserId: string) {
  const me = await requireUserId(); // read-state only — no ban check needed

  await prisma.message.updateMany({
    where: {
      senderId: otherUserId,
      recipientId: me,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/dm");
}

// Unsend: owner-gated plain row delete (reports cascade via schema).
export async function deleteMessage(messageId: string) {
  const me = await requireUserId();

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true },
  });
  if (!msg) return { ok: true }; // already gone — goal state reached
  if (msg.senderId !== me) throw new Error("Forbidden");

  await prisma.message.delete({ where: { id: messageId } });
  revalidatePath("/dm");
  revalidatePath(`/dm/${msg.senderId}`);
  return { ok: true };
}

// IG-style emoji reaction toggle. Only thread participants may react;
// whitelist keeps emoji values sane; second tap removes (unique constraint).
const REACTION_EMOJIS = ["❤️", "😂", "🔥", "👍", "😮", "😢"];

export async function toggleMessageReaction(
  messageId: string,
  emoji: string
): Promise<{ ok: boolean; active: boolean }> {
  const me = await requireUserId();
  if (!REACTION_EMOJIS.includes(emoji)) throw new Error("Unsupported reaction");

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, recipientId: true },
  });
  if (!msg || (msg.senderId !== me && msg.recipientId !== me)) {
    throw new Error("Forbidden");
  }

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId, userId: me, emoji },
    },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    return { ok: true, active: false };
  }
  await prisma.messageReaction.create({ data: { messageId, userId: me, emoji } });
  return { ok: true, active: true };
}

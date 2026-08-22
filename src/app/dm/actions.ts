"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { requireActiveUser, requireUserId } from "@/lib/session";

// Send a direct message. Creates the message and clears read state on the
// recipient's side naturally (their unread count is computed per-thread).
export async function sendMessage(recipientId: string, content: string) {
  const me = (await requireActiveUser()).id;

  if (me === recipientId) throw new Error("Cannot message yourself");
  if (!content.trim()) throw new Error("Message required");
  if (content.length > 2000) throw new Error("Message too long");

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) throw new Error("User not found");

  const msg = await prisma.message.create({
    data: {
      senderId: me,
      recipientId,
      content: content.trim(),
    },
  });

  await createNotification({
    userId: recipientId,
    actorId: me,
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

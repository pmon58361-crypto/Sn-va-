"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Send a direct message. Creates the message and clears read state on the
// recipient's side naturally (their unread count is computed per-thread).
export async function sendMessage(recipientId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;

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

  revalidatePath("/dm");
  revalidatePath(`/dm/${recipientId}`);
  return { id: msg.id, createdAt: msg.createdAt.toISOString() };
}

// Mark every unread message in a thread (from `otherUserId` to me) as read.
export async function markThreadRead(otherUserId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.message.updateMany({
    where: {
      senderId: otherUserId,
      recipientId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/dm");
}

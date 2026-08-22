import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "comment"
  | "like"
  | "follow"
  | "application"
  | "application_accepted"
  | "application_rejected"
  | "message";

// Creates a notification for `userId` about something `actorId` did.
// Never notifies about your own actions, and collapses repeated unread
// notifications of the same kind (e.g. ten likes before you check in
// become one row).
export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  postId?: string | null;
}) {
  const { userId, actorId, type, postId } = input;
  if (!userId) return;
  if (actorId && actorId === userId) return;

  const dupe = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      actorId: actorId ?? null,
      postId: postId ?? null,
      read: false,
    },
    select: { id: true },
  });
  if (dupe) return;

  await prisma.notification.create({
    data: { userId, actorId: actorId ?? null, type, postId: postId ?? null },
  });
}

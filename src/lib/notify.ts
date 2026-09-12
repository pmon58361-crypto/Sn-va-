import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "comment"
  | "like"
  | "follow"
  | "application"
  | "application_accepted"
  | "application_rejected"
  | "message"
  | "group_mention"
  | "group_message";

// Creates a notification for `userId` about something `actorId` did.
// Never notifies about your own actions, and collapses repeated unread
// notifications of the same kind (e.g. ten likes before you check in
// become one row).
export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  postId?: string | null;
  groupId?: string | null;
}) {
  const { userId, actorId, type, postId, groupId } = input;
  if (!userId) return;
  if (actorId && actorId === userId) return;

  const dupe = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      actorId: actorId ?? null,
      postId: postId ?? null,
      groupId: groupId ?? null,
      read: false,
    },
    select: { id: true },
  });
  if (dupe) return;

  await prisma.notification.create({
    data: {
      userId,
      actorId: actorId ?? null,
      type,
      postId: postId ?? null,
      groupId: groupId ?? null,
    },
  });
}

// Display handle, same rule as profiles: display name, lowercased,
// alphanumeric + underscore, 24 chars, never the email.
export function memberHandle(name: string | null): string {
  return (
    (name || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 24) ||
    "member"
  );
}

// Group-room fan-out. Mentions (@handle, matched against member display
// names/handles) get group_mention rows; every other member gets one
// group_message row (collapsed per sender until read — the existing dupe
// rule is the spam control, so busy rooms cost one row per talker).
// Fire-and-forget from the send path: notification failure must never fail
// the message itself.
export async function notifyGroupMessage(input: {
  groupId: string;
  senderId: string;
  content: string;
}): Promise<void> {
  const { groupId, senderId, content } = input;
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true, user: { select: { name: true } } },
  });
  const others = members.filter((m) => m.userId !== senderId);
  if (others.length === 0) return;

  const tokens = new Set(
    content
      .split(/\s+/)
      .filter((t) => t.startsWith("@") && t.length > 1)
      .map((t) =>
        t
          .slice(1)
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "")
          .slice(0, 24)
      )
      .filter(Boolean)
  );
  const mentioned = new Set<string>();
  if (tokens.size > 0) {
    for (const m of others) {
      if (tokens.has(memberHandle(m.user.name))) mentioned.add(m.userId);
    }
  }

  await Promise.all([
    ...[...mentioned].map((userId) =>
      createNotification({ userId, actorId: senderId, type: "group_mention", groupId })
    ),
    ...others
      .filter((m) => !mentioned.has(m.userId))
      .map((m) =>
        createNotification({ userId: m.userId, actorId: senderId, type: "group_message", groupId })
      ),
  ]);
}

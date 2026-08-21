import { prisma } from "@/lib/prisma";

// All users I've exchanged messages with, most recent thread first,
// with last-message preview + unread count per thread.
export async function getConversations(meId: string) {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: meId }, { recipientId: meId }],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      sender: { select: { id: true, name: true, image: true } },
      recipient: { select: { id: true, name: true, image: true } },
    },
  });

  const threads = new Map<
    string,
    {
      other: { id: string; name: string | null; image: string | null };
      lastAt: Date;
      lastPreview: string;
      lastFromMe: boolean;
      unread: number;
    }
  >();

  for (const m of messages) {
    const other =
      m.senderId === meId
        ? m.recipient
        : m.sender;
    const existing = threads.get(other.id);
    if (existing) {
      if (!m.readAt && m.recipientId === meId) existing.unread += 1;
    } else {
      threads.set(other.id, {
        other,
        lastAt: m.createdAt,
        lastPreview: m.content,
        lastFromMe: m.senderId === meId,
        unread: !m.readAt && m.recipientId === meId ? 1 : 0,
      });
    }
  }

  return Array.from(threads.values()).sort(
    (a, b) => b.lastAt.getTime() - a.lastAt.getTime()
  );
}

export async function getThread(meId: string, otherId: string) {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: meId, recipientId: otherId },
        { senderId: otherId, recipientId: meId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      senderId: true,
      content: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function getUnreadCount(meId: string) {
  return prisma.message.count({
    where: { recipientId: meId, readAt: null },
  });
}

export async function getUserBrief(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true, bio: true },
  });
}

// People I can start a new conversation with.
export async function getMessageableUsers(meId: string) {
  // Everyone except me and people I already have a thread with.
  const convos = await getConversations(meId);
  const existing = new Set(convos.map((c) => c.other.id));

  const users = await prisma.user.findMany({
    where: { id: { notIn: [meId, ...Array.from(existing)] } },
    select: { id: true, name: true, image: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return users;
}

// Server-component-safe wrapper (no revalidate) for marking a thread read.
export async function markThreadReadSafe(meId: string, otherId: string) {
  await prisma.message.updateMany({
    where: { senderId: otherId, recipientId: meId, readAt: null },
    data: { readAt: new Date() },
  });
}

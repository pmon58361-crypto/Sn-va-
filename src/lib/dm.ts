import { prisma } from "@/lib/prisma";

// All users I've exchanged messages with, most recent thread first,
// with last-message preview + unread count per thread.
export async function getConversations(meId: string) {
  const messages = await prisma.message.findMany({
    where: {
      // Deactivated counterparts drop out of the list entirely (their
      // relation arm is filtered on each side of the OR).
      OR: [
        { senderId: meId, recipient: { deactivatedAt: null } },
        { recipientId: meId, sender: { deactivatedAt: null } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      sender: { select: { id: true, name: true, image: true, createdAt: true } },
      recipient: { select: { id: true, name: true, image: true, createdAt: true } },
    },
  });

  const threads = new Map<
    string,
    {
      other: {
        id: string;
        name: string | null;
        image: string | null;
        createdAt: Date;
      };
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
    // Group-room rows have no 1:1 counterpart (and the query's nested
    // relation filter already excludes them) — skip defensively so the
    // conversation list stays strictly 1:1.
    if (!other) continue;
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
  const where = {
    OR: [
      { senderId: meId, recipientId: otherId },
      { senderId: otherId, recipientId: meId },
    ],
  };
  const select = {
    id: true,
    senderId: true,
    content: true,
    imageUrl: true,
    readAt: true,
    createdAt: true,
    reactions: { select: { userId: true, emoji: true } },
  };
  try {
    return await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 200,
      select,
    });
  } catch (err) {
    // Schema-window resilience: if Message.imageUrl hasn't landed on this
    // database branch yet, fall back to text-only instead of 500ing DMs.
    if (!(err instanceof Error) || !/imageUrl|does not exist/i.test(err.message)) throw err;
    const { imageUrl: _dropped, ...textSelect } = select;
    const rows = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 200,
      select: textSelect,
    });
    return rows.map((r) => ({ ...r, imageUrl: null as string | null }));
  }
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
    where: { id: { notIn: [meId, ...Array.from(existing)] }, deactivatedAt: null },
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

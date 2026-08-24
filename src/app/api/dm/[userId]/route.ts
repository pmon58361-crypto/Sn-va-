import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dm/[userId]?after=<ISO timestamp>
// Returns messages in the thread newer than `after` (polling endpoint).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const meId = session.user.id;
  const { userId } = await params;

  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: meId, recipientId: userId },
        { senderId: userId, recipientId: meId },
      ],
      // gte (not gt): same-millisecond messages must not be skipped; the
      // client dedupes by id, so re-delivering the boundary row is harmless.
      ...(after && !isNaN(after.getTime()) ? { createdAt: { gte: after } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      senderId: true,
      content: true,
      readAt: true,
      createdAt: true,
      reactions: { select: { userId: true, emoji: true } },
    },
  });

  // Full reaction map for the thread tail — lets every client reconcile
  // reaction state each tick (toggles by the peer show up without reload).
  const reactions = await prisma.messageReaction.findMany({
    where: {
      message: {
        OR: [
          { senderId: meId, recipientId: userId },
          { senderId: userId, recipientId: meId },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { messageId: true, userId: true, emoji: true },
  });

  // Newest time the peer read any of MY messages -> drives the "Seen" label.
  const seen = await prisma.message.findFirst({
    where: { senderId: meId, recipientId: userId, readAt: { not: null } },
    orderBy: { readAt: "desc" },
    select: { readAt: true },
  });

  // Recent-id window so clients notice unsent (deleted) messages without a
  // full refetch: anything newer than windowStart must appear in recentIds.
  const recent = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: meId, recipientId: userId },
        { senderId: userId, recipientId: meId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    messages,
    reactions,
    seenAt: seen?.readAt ? seen.readAt.toISOString() : null,
    recentIds: recent.map((r) => r.id),
    windowStart:
      recent.length > 0
        ? recent[recent.length - 1].createdAt.toISOString()
        : null,
    // SERVER-authoritative poll cursor. Clients must advance their cursor
    // from this — never from locally-generated timestamps (optimistic rows
    // carry the client clock; skew silently filters incoming messages).
    cursor:
      recent.length > 0 ? recent[0].createdAt.toISOString() : null,
  });
}

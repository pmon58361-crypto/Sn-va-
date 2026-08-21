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
      ...(after && !isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      senderId: true,
      content: true,
      readAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages });
}

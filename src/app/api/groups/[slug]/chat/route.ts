import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/groups";
import { notifyGroupMessage } from "@/lib/notify";
import { claimUploads } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const messageSelect = {
  id: true,
  senderId: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  sender: { select: { id: true, name: true, image: true } },
};

async function groupIdFor(slug: string, meId: string) {
  const group = await prisma.group.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!group) return null;
  const membership = await getMembership(group.id, meId);
  if (!membership) return null;
  return group.id;
}

// GET /api/groups/[slug]/chat?after=<ISO> — member-only poll endpoint.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const groupId = await groupIdFor(slug, session.user.id);
  if (!groupId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;
  const messages = await prisma.message.findMany({
    where: {
      groupId,
      ...(after && !isNaN(after.getTime()) ? { createdAt: { gte: after } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: messageSelect,
  });
  return NextResponse.json({ messages });
}

// POST /api/groups/[slug]/chat — member-only send (text + optional photo).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const groupId = await groupIdFor(slug, session.user.id);
  if (!groupId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { content?: unknown; imageUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  if (!content && !imageUrl) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Too long" }, { status: 400 });
  }
  if (imageUrl && !imageUrl.startsWith("https://") && !imageUrl.startsWith("/uploads/")) {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      senderId: session.user.id,
      recipientId: null,
      groupId,
      content: content.slice(0, 2000),
      imageUrl,
    },
    select: messageSelect,
  });
  // Fan-out runs after the send resolves and never fails it.
  notifyGroupMessage({ groupId, senderId: session.user.id, content }).catch(() => {});
  // Claim the attachment (if any) in the same request.
  await claimUploads(session.user.id, [imageUrl], "group_chat");
  return NextResponse.json({ message });
}

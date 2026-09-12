import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/users/[id]/follows?kind=followers|following — public follow
// lists (counts are already public on profiles). Viewer-scoped
// followedByMe included for signed-in callers so rows can carry live
// follow buttons.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "followers" && kind !== "following") {
    return NextResponse.json({ error: "Bad kind" }, { status: 400 });
  }
  const session = await auth().catch(() => null);
  const meId = session?.user?.id;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.follow.findMany({
    where: kind === "followers" ? { followingId: id } : { followerId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      follower: { select: { id: true, name: true, image: true } },
      following: { select: { id: true, name: true, image: true } },
    },
  });
  const users = rows.map((r) =>
    kind === "followers" ? r.follower : r.following
  );
  let followedByMe = new Set<string>();
  if (meId && users.length) {
    const mine = await prisma.follow.findMany({
      where: { followerId: meId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    });
    followedByMe = new Set(mine.map((m) => m.followingId));
  }
  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      followedByMe: followedByMe.has(u.id),
      isMe: u.id === meId,
    })),
  });
}

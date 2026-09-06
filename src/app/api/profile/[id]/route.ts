import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFollowing } from "@/lib/social";

/**
 * GET /api/profile/[id] — mini profile for hover cards.
 * Privacy: full card only when the target is public, the viewer, or someone
 * the viewer follows/is followed contextually. Otherwise name + avatar only
 * (mirrors the profile page's privacy stance, never leaks bio to strangers).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const meId = session?.user?.id ?? null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      location: true,
      deactivatedAt: true,
      settings: { select: { publicProfile: true } },
      _count: { select: { followers: true, posts: true } },
    },
  });
  if (!user || user.deactivatedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const self = meId === user.id;
  const pub = user.settings?.publicProfile ?? true;
  const following = meId && !self ? await isFollowing(meId, user.id) : false;
  const visible = pub || self || following;

  return NextResponse.json({
    id: user.id,
    name: user.name,
    image: user.image,
    bio: visible ? user.bio : null,
    location: visible ? user.location : null,
    followers: visible ? user._count.followers : 0,
    posts: visible ? user._count.posts : 0,
    following: !!following,
    self,
    private: !visible,
  });
}

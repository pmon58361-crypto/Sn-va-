import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/push/unsubscribe { endpoint }
// Removes one device. Scoped to the caller's own rows only.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.endpoint !== "string") {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }
  await prisma.pushSubscription
    .deleteMany({
      where: { endpoint: body.endpoint, userId: session.user.id },
    })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}

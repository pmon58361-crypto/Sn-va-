import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/push/subscribe — store (or refresh) this browser's subscription
// and flip the notifyMessages master switch on (explicit opt-in).
// DELETE /api/push/subscribe — remove one endpoint (opt-out per device).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  const endpoint = body?.endpoint || "";
  const p256dh = body?.keys?.p256dh || "";
  const authKey = body?.keys?.auth || "";
  if (!endpoint.startsWith("https://") || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: session.user.id, p256dh, auth: authKey },
    create: { userId: session.user.id, endpoint, p256dh, auth: authKey },
  });
  await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: { notifyMessages: true },
    create: { userId: session.user.id, notifyMessages: true },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await prisma.pushSubscription
    .deleteMany({
      where: { endpoint: body.endpoint, userId: session.user.id },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}

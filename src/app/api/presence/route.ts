import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { beat, getPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

const ALLOWED_AREAS = new Set([
  "Community",
  "Reading a post",
  "Jobs",
  "Applications",
  "DMs",
  "Profiles",
  "Leaderboard",
  "Settings",
  "Exploring Snívať",
]);

// POST — heartbeat: records the user's current AREA (category only).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const page =
    body && typeof body.page === "string" && ALLOWED_AREAS.has(body.page)
      ? body.page
      : "Exploring Snívať";
  beat(session.user.id, page);
  return NextResponse.json({ ok: true });
}

// GET ?ids=a,b,c — presence snapshot for rendering dots.
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .slice(0, 200);
  return NextResponse.json(getPresence(ids));
}

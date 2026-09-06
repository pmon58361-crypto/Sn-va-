import { NextResponse } from "next/server";

// GET /api/push/public-key — the VAPID public key is public by design.
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY || null;
  return NextResponse.json({ publicKey: key });
}

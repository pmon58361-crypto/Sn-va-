import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/stripe/webhook — Stripe event receiver. Verifies the signature
// (never trusts the body alone), then credits the ad on
// checkout.session.completed. Crediting is IDEMPOTENT: paidCents only moves
// forward to the session total, so duplicate deliveries can't double-fund.
// Funding unlocks review (paid, still unapproved) — an admin approves after.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 400 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false }, { status: 400 });

  let event;
  try {
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      amount_total: number | null;
      metadata?: { adId?: string };
    };
    const adId = session.metadata?.adId;
    const paid = session.amount_total ?? 0;
    if (adId && paid > 0) {
      try {
        const ad = await prisma.ad.findUnique({
          where: { id: adId },
          select: { paidCents: true, budgetCents: true },
        });
        if (ad) {
          // Monotonic credit: never move paid backwards on redelivery.
          const next = Math.max(ad.paidCents, Math.min(paid, ad.budgetCents ?? paid));
          await prisma.ad.update({ where: { id: adId }, data: { paidCents: next } });
        }
      } catch (err) {
        console.warn("[stripe] funding credit failed:", err);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

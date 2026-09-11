"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://snivat.vercel.app";

// Self-serve ad creation. Always lands unapproved + inactive — an admin
// approves from /admin/ads. Budget is REQUIRED here (admin creation may
// leave it open; self-serve must be prepaid). No image upload v1:
// headline-only ads render fine, images come via admin edit.
export async function createAdvertiserAd(formData: FormData): Promise<void> {
  const session = await auth();
  const meId = session?.user?.id;
  if (!meId) redirect("/auth/signin?callbackUrl=/advertise");

  const headline = String(formData.get("headline") || "").trim();
  const targetUrl = String(formData.get("targetUrl") || "").trim();
  const placement = String(formData.get("placement") || "").trim().toUpperCase();
  const budget = Math.trunc(Number(formData.get("budgetCents")));
  const topics = String(formData.get("topics") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  if (!headline || headline.length > 200) redirect("/advertise?error=headline");
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    redirect("/advertise?error=url");
  }
  if (url.protocol !== "https:") redirect("/advertise?error=url");
  if (placement !== "FEED" && placement !== "SIDEBAR") redirect("/advertise?error=placement");
  if (!Number.isFinite(budget) || budget < 100 || budget > 100_000_000) {
    redirect("/advertise?error=budget");
  }

  const me = await prisma.user.findUnique({
    where: { id: meId },
    select: { name: true },
  });
  await prisma.ad.create({
    data: {
      advertiser: me?.name || "Someone",
      headline,
      targetUrl,
      placement,
      budgetCents: budget,
      topics: topics.length > 0 ? [...new Set(topics)].join(",") : null,
      approved: false,
      active: false,
      userId: meId,
    },
  });
  revalidatePath("/advertise");
  redirect("/advertise?created=1");
}

// Fund an ad up to its budget via Stripe Checkout. Without keys this
// bounces back with a notice (zero-JS pattern: message via search param).
export async function fundAd(formData: FormData): Promise<void> {
  const session = await auth();
  const meId = session?.user?.id;
  if (!meId) redirect("/auth/signin?callbackUrl=/advertise");
  const adId = String(formData.get("adId") || "");
  if (!adId) redirect("/advertise");

  if (!stripeConfigured()) redirect("/advertise?fund=unavailable");

  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { userId: true, budgetCents: true, paidCents: true, headline: true },
  });
  const isAdmin = session.user.role === "admin";
  if (!ad || (ad.userId !== meId && !isAdmin)) redirect("/advertise");
  const remaining = (ad.budgetCents ?? 0) - ad.paidCents;
  if (!ad.budgetCents || remaining <= 0) redirect("/advertise");

  const stripe = getStripe()!;
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "usd",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: remaining,
          product_data: { name: `Snivat ad budget: ${ad.headline.slice(0, 60)}` },
        },
        quantity: 1,
      },
    ],
    metadata: { adId, userId: meId },
    success_url: `${SITE_URL}/advertise/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/advertise`,
  });
  if (!checkout.url) redirect("/advertise?fund=error");
  redirect(checkout.url);
}

import Stripe from "stripe";

// Lazy Stripe client. Null when keys are absent (user hasn't added them
// yet) — every funding path checks stripeConfigured() first and explains
// itself instead of crashing. Follows the Cloudinary idiom elsewhere.
let client: Stripe | null | undefined;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  if (!process.env.STRIPE_SECRET_KEY) {
    client = null;
    return client;
  }
  client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export function paymentsUnavailable(): string {
  return "Card payments aren't connected yet — your ad is saved and pending. The owner enables funding from the admin panel, then you can fund it.";
}

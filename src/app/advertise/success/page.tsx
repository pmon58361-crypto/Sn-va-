import Link from "next/link";

export const metadata = { title: "Payment received", robots: { index: false } };

// Funding landing page. The webhook credits the ad asynchronously, so this
// page makes no payment claims beyond "received" — the ad row itself is the
// source of truth (funded → in review → live).
export default function AdvertiseSuccessPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">
        Payment received
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Your budget is being credited. Once it lands, your ad waits for a
        quick human review — then it starts rotating.
      </p>
      <Link href="/advertise" className="btn-primary mt-6 inline-block px-5 py-2 text-sm">
        Back to your ads
      </Link>
    </div>
  );
}

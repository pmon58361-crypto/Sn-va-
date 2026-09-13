import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { submitBusinessClaim } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify business", robots: { index: false } };

const inputCls = "input";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1";

const ERRORS: Record<string, string> = {
  name: "Give your business a name (letters and numbers only).",
  proof: "Add at least one proof: website, public listing link, or storefront photo.",
  pending: "You already have a claim under review — wait for the decision first.",
  verified: "This account is already verified.",
  ads: "Running ads needs a verified business — submit your proof below and ads unlock on approval.",
};

export default async function VerifyBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/verify-business");
  const meId = session.user.id;
  const { submitted, error } = await searchParams;

  const [me, claims] = await Promise.all([
    prisma.user.findUnique({
      where: { id: meId },
      select: { businessName: true, businessVerifiedAt: true },
    }),
    prisma.businessClaim.findMany({
      where: { userId: meId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const verified = !!me?.businessVerifiedAt;
  const pending = claims.find((c) => c.status === "pending");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow mb-1.5">Business verification</p>
      <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
        Prove you own the business
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Verified businesses get the ✓ badge and can post jobs and run ads.
        Proof must be public evidence an admin can open: your website, a
        registry entry, your official social page, or a storefront photo.
      </p>

      {submitted && (
        <p className="mt-4 rounded-xl border border-accent/40 bg-accent-tint px-4 py-3 text-sm text-accent">
          Claim received — an admin reviews it soon. Posting unlocks on approval.
        </p>
      )}
      {error && ERRORS[error] && (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          {ERRORS[error]}
        </p>
      )}

      {verified ? (
        <div className="card mt-6 p-5">
          <p className="text-sm font-bold text-ink">
            ✓ Verified as {me?.businessName || "your business"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Jobs and ads are unlocked. The badge shows on your profile and posts.
          </p>
          <Link href="/advertise" className="btn-primary mt-4 inline-block px-4 py-2 text-sm">
            Run an ad →
          </Link>
        </div>
      ) : pending ? (
        <div className="card mt-6 p-5">
          <p className="text-sm font-bold text-ink">Under review</p>
          <p className="mt-1 text-sm text-ink-muted">
            “{pending.businessName}” was submitted{" "}
            {pending.createdAt.toLocaleDateString()}. You’ll see the badge here
            once approved.
          </p>
        </div>
      ) : (
        <form action={submitBusinessClaim} className="card mt-6 space-y-4 p-5">
          <div>
            <label htmlFor="businessName" className={labelCls}>
              Business name
            </label>
            <input
              id="businessName"
              name="businessName"
              required
              maxLength={60}
              placeholder="e.g. Himalayan Crafts"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="website" className={labelCls}>
              Business website (https)
            </label>
            <input
              id="website"
              name="website"
              type="url"
              inputMode="url"
              placeholder="https://…"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="proofUrl" className={labelCls}>
              Public proof link (registry, official social page, menu)
            </label>
            <input
              id="proofUrl"
              name="proofUrl"
              type="url"
              inputMode="url"
              placeholder="https://…"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="proofImageUrl" className={labelCls}>
              Storefront / license photo URL (upload first, paste the link)
            </label>
            <input
              id="proofImageUrl"
              name="proofImageUrl"
              type="url"
              inputMode="url"
              placeholder="https://…"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-ink-faint">
              At least one of the three proofs above is required.
            </p>
          </div>
          <button type="submit" className="btn-primary w-full py-2.5 text-sm">
            Submit for review
          </button>
        </form>
      )}

      {claims.length > 0 && (
        <div className="card mt-6 p-5">
          <h2 className="text-sm font-bold text-ink">History</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{c.businessName}</span>
                <span
                  className={`badge shrink-0 text-xs capitalize ${
                    c.status === "approved"
                      ? "bg-accent-tint text-accent"
                      : c.status === "rejected"
                        ? "bg-warm/15 text-warm"
                        : "bg-soft text-ink-muted"
                  }`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

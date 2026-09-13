import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { approveBusinessClaim, rejectBusinessClaim, revokeBusinessVerification } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business claims", robots: { index: false } };

export default async function AdminBusinessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "admin") redirect("/");

  const [pending, recent, verified] = await Promise.all([
    prisma.businessClaim.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.businessClaim.findMany({
      where: { status: { not: "pending" } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { businessVerifiedAt: { not: null } },
      orderBy: { businessVerifiedAt: "desc" },
      select: { id: true, name: true, businessName: true, businessVerifiedAt: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Moderation
      </Link>
      <h1 className="mt-2 text-xl font-bold tracking-tight text-ink">
        Business claims ({pending.length} pending)
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Open every proof link and match it to the claimant before approving.
        Approval stamps the account with the ✓ badge and unlocks jobs + ads.
      </p>

      <div className="mt-6 space-y-3">
        {pending.length === 0 && (
          <p className="card p-5 text-sm text-ink-muted">Queue is clear.</p>
        )}
        {pending.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink">{c.businessName}</p>
              <p className="text-xs text-ink-faint">
                {c.createdAt.toLocaleDateString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {c.user.name || "Anonymous"} · {c.user.email} ·{" "}
              <Link
                href={`/profile/${c.user.id}`}
                className="underline hover:text-ink"
              >
                profile
              </Link>
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {c.website && (
                <li>
                  <a
                    href={c.website}
                    target="_blank"
                    rel="nofollow noopener"
                    className="text-accent underline"
                  >
                    Website ↗
                  </a>
                </li>
              )}
              {c.proofUrl && (
                <li>
                  <a
                    href={c.proofUrl}
                    target="_blank"
                    rel="nofollow noopener"
                    className="text-accent underline"
                  >
                    Proof link ↗
                  </a>
                </li>
              )}
              {c.proofImageUrl && (
                <li>
                  <a
                    href={c.proofImageUrl}
                    target="_blank"
                    rel="nofollow noopener"
                    className="text-accent underline"
                  >
                    Proof photo ↗
                  </a>
                </li>
              )}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <form action={approveBusinessClaim}>
                <input type="hidden" name="claimId" value={c.id} />
                <button type="submit" className="btn-primary px-4 py-2 text-sm">
                  Approve
                </button>
              </form>
              <form action={rejectBusinessClaim} className="flex flex-1 flex-wrap gap-2">
                <input type="hidden" name="claimId" value={c.id} />
                <input
                  name="reason"
                  maxLength={200}
                  placeholder="Reason (shown to claimant)…"
                  className="input min-w-0 flex-1"
                />
                <button type="submit" className="btn-outline px-4 py-2 text-sm">
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {verified.length > 0 && (
        <div className="card mt-8 p-5">
          <h2 className="text-sm font-bold text-ink">
            Verified businesses ({verified.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {verified.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-semibold text-ink">
                    ✓ {v.businessName || "Business"}
                  </span>{" "}
                  <span className="text-ink-muted">
                    · {v.name || "Anonymous"} · since{" "}
                    {v.businessVerifiedAt?.toLocaleDateString()}
                  </span>
                </span>
                <form action={revokeBusinessVerification}>
                  <input type="hidden" name="userId" value={v.id} />
                  <button type="submit" className="btn-outline px-3 py-1 text-xs">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card mt-8 p-5">
          <h2 className="text-sm font-bold text-ink">Recently reviewed</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {c.businessName} · {c.user.name || "Anonymous"}
                </span>
                <span
                  className={`badge shrink-0 text-xs capitalize ${
                    c.status === "approved"
                      ? "bg-accent-tint text-accent"
                      : "bg-warm/15 text-warm"
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

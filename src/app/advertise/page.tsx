import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spendCents, formatCents } from "@/lib/ads-money";
import { createAdvertiserAd, fundAd } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advertise", robots: { index: false } };

const inputCls = "input";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1";

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; fund?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/advertise");
  const meId = session.user.id;
  const { created, fund, error } = await searchParams;

  const myAds = await prisma.ad.findMany({
    where: { userId: meId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      headline: true,
      placement: true,
      active: true,
      approved: true,
      budgetCents: true,
      paidCents: true,
      impressions: true,
      clicks: true,
      rateCpmCents: true,
      rateCpcCents: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow mb-1.5">Advertise</p>
      <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
        Put your thing in front of builders
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Set a budget, fund it when payments connect, get approved, and your
        card rotates through the feed and sidebar. You only accrue what serves.
      </p>

      {created && (
        <p className="mt-4 rounded-xl border border-accent/40 bg-accent-tint px-4 py-3 text-sm text-accent">
          Ad saved — fund it below, then it waits for a quick human review.
        </p>
      )}
      {fund === "unavailable" && (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          Card payments aren&apos;t connected yet — your ad stays saved and
          pending. Ask the site owner to connect funding.
        </p>
      )}
      {fund === "error" && (
        <p className="mt-4 rounded-xl border border-warm bg-warm-tint px-4 py-3 text-sm text-warm">
          Checkout couldn&apos;t start. Try again in a moment.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-warm bg-warm-tint px-4 py-3 text-sm text-warm">
          That didn&apos;t save — check the headline, https URL, and a budget
          of at least $1.
        </p>
      )}

      {/* Create — native form, zero client JS */}
      <section className="card mt-6 p-5" aria-label="Create an ad">
        <h2 className="mb-4 text-sm font-semibold text-ink">New ad</h2>
        <form action={createAdvertiserAd}>
          <div>
            <label className={labelCls} htmlFor="ad-headline">Headline</label>
            <input
              id="ad-headline"
              name="headline"
              required
              maxLength={200}
              placeholder="What should builders click?"
              className={inputCls}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ad-url">Target URL (https)</label>
              <input
                id="ad-url"
                name="targetUrl"
                required
                inputMode="url"
                placeholder="https://your-site.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ad-budget">Budget ¢ (min $1)</label>
              <input
                id="ad-budget"
                name="budgetCents"
                required
                inputMode="numeric"
                placeholder="e.g. 5000 ($50)"
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ad-placement">Placement</label>
              <select id="ad-placement" name="placement" className={inputCls} defaultValue="FEED">
                <option value="FEED">Feed</option>
                <option value="SIDEBAR">Sidebar</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ad-topics">Topics (optional)</label>
              <input
                id="ad-topics"
                name="topics"
                maxLength={200}
                placeholder="react, design, remote"
                className={inputCls}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4 px-5 py-2 text-sm">
            Save ad for review
          </button>
        </form>
      </section>

      {/* My ads */}
      <section className="mt-8" aria-label="My ads">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          My ads{myAds.length > 0 ? ` (${myAds.length})` : ""}
        </h2>
        {myAds.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-ink-faint">
            Nothing here yet — your first ad takes a minute.
          </p>
        ) : (
          <ul className="space-y-3">
            {myAds.map((a) => {
              const spent = spendCents(a);
              const funded = a.paidCents >= (a.budgetCents ?? 0) && (a.budgetCents ?? 0) > 0;
              const state = !a.approved
                ? funded
                  ? "In review"
                  : "Needs funding"
                : a.active
                  ? "Live"
                  : "Paused";
              return (
                <li key={a.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {a.headline}
                    </p>
                    <span
                      className={`badge shrink-0 ${
                        state === "Live"
                          ? "bg-accent-tint text-accent"
                          : "bg-soft text-ink-muted"
                      }`}
                    >
                      {state}
                    </span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-ink-muted">
                    {a.impressions} views · {a.clicks} clicks · {formatCents(spent)} spent
                    {a.budgetCents != null ? ` of ${formatCents(a.budgetCents)}` : ""}
                    {a.paidCents > 0 ? ` · ${formatCents(a.paidCents)} funded` : ""}
                  </p>
                  {!funded && (
                    <form action={fundAd} className="mt-3">
                      <input type="hidden" name="adId" value={a.id} />
                      <button type="submit" className="btn-outline px-4 py-1.5 text-xs">
                        Fund {formatCents((a.budgetCents ?? 0) - a.paidCents)}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Ads are labeled Sponsored, never track, and pause automatically at budget.{" "}
        <Link href="/community" className="hover:text-accent hover:underline">
          Back to community
        </Link>
      </p>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdsManager, type AdsManagerAd } from "./AdsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ads — Snívať" };

export default async function AdminAdsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "admin") redirect("/");

  const ads = await prisma.ad.findMany({ orderBy: { createdAt: "desc" } });

  const initial: AdsManagerAd[] = ads.map((a) => ({
    id: a.id,
    advertiser: a.advertiser,
    headline: a.headline,
    imageUrl: a.imageUrl,
    targetUrl: a.targetUrl,
    placement: a.placement,
    active: a.active,
    startsAt: a.startsAt ? a.startsAt.toISOString() : null,
    endsAt: a.endsAt ? a.endsAt.toISOString() : null,
    impressions: a.impressions,
    clicks: a.clicks,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <Link
          href="/admin"
          className="mb-2 inline-block text-sm text-ink-muted transition hover:text-accent"
        >
          ← Moderation
        </Link>
        <h1 className="text-xl font-bold text-ink">Ads</h1>
        <p className="text-sm text-ink-muted">
          First-party sponsored placements. Zero tracking — impressions and
          clicks are the only numbers that exist.
        </p>
      </header>

      <AdsManager initial={initial} />
    </div>
  );
}

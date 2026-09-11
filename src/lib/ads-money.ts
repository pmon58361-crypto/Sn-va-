// Ad money math — pure, no database, safe to import from client
// components (AdsManager) AND server code (lib/ads). The single source of
// truth for "what is owed": spend derives from counters × rates, so billing
// can never drift from what was served.
//
// Units: rates and budgets are integer CENTS. Ledger rows use thousandths
// of a cent (millicents) so per-event costs stay exact integers:
//   impression = CPM/1000¢ → rateCpmCents millicents (always exact)
//   click      = full CPC  → rateCpcCents × 1000 millicents

export type BillableAd = {
  impressions: number;
  clicks: number;
  rateCpmCents: number | null;
  rateCpcCents: number | null;
  budgetCents: number | null;
};

/** Derived spend in cents (float): impressions × CPM/1000 + clicks × CPC. */
export function spendCents(ad: BillableAd): number {
  const imp = ad.rateCpmCents != null ? (ad.impressions * ad.rateCpmCents) / 1000 : 0;
  const clk = ad.rateCpcCents != null ? ad.clicks * ad.rateCpcCents : 0;
  return imp + clk;
}

/** True when a set budget exists and derived spend has reached it. */
export function overBudget(ad: BillableAd): boolean {
  return ad.budgetCents != null && spendCents(ad) >= ad.budgetCents;
}

/** Exact per-event ledger cost in millicents (integer, never float dust). */
export function eventCostMillicents(
  type: "impression" | "click",
  ad: Pick<BillableAd, "rateCpmCents" | "rateCpcCents">
): number {
  if (type === "impression") return ad.rateCpmCents ?? 0;
  return (ad.rateCpcCents ?? 0) * 1000;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

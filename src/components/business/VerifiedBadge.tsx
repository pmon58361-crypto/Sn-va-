// Shared verified-business mark. Solid gold, flat (no gradients — those
// belong to the brand mark only), one SVG check, no emoji. Two sizes:
// "sm" rides post-card author lines, "md" carries the business name on
// profiles. Rendered only when businessVerifiedAt is set — the badge is
// earned in the DB, never restyled into existence.
export function VerifiedBadge({
  businessName,
  size = "sm",
}: {
  businessName?: string | null;
  size?: "sm" | "md";
}) {
  const label = size === "md" ? `✓ ${businessName || "Business"}` : "✓ Business";
  return (
    <span
      title={
        size === "md" && businessName
          ? `Verified business — ${businessName}`
          : "Verified business"
      }
      className={
        size === "md"
          ? "badge bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-ink)]"
          : "ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[var(--accent)] px-2 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-[var(--accent-ink)]"
      }
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </span>
  );
}

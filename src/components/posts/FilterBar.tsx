import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────
// FilterBar — server-rendered chip groups for the job board.
// Every chip is a plain <Link> that patches ONE URL param while keeping the
// rest, so filtering works with zero client JS and stays shareable/bookmarkable.
// ─────────────────────────────────────────────────────────────────────────

export type FilterGroup = {
  /** Param key this group writes to. */
  param: string;
  /** Mono label shown above/next to the chips. */
  label: string;
  /** value → label options; "" (or special) = "any". */
  options: { value: string; label: string }[];
};

type CurrentParams = Record<string, string | undefined>;

function buildHref(
  base: string,
  current: CurrentParams,
  patch: CurrentParams
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

const chipBase =
  "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors whitespace-nowrap";
const chipIdle =
  "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/30 hover:text-white";
const chipActive =
  "border-amber-400/60 bg-amber-400/10 text-amber-300 hover:border-amber-400/80";

export function FilterBar({
  base,
  current,
  groups,
}: {
  /** Path to link to, e.g. "/jobs" or "/applications". */
  base: string;
  /** Currently active searchParams. */
  current: CurrentParams;
  groups: FilterGroup[];
}) {
  // Any filter actually set? Controls the "clear" chip.
  const anyActive = groups.some((g) => {
    const anyValue = g.options[0]?.value ?? "";
    return current[g.param] && current[g.param] !== anyValue;
  });

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-line bg-soft/60 p-4">
      {groups.map((g) => (
        <div key={g.param} className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {g.label}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {g.options.map((o) => {
              const active = (current[g.param] || o.value) === o.value;
              return (
                <Link
                  key={o.value || "any"}
                  href={buildHref(base, current, { [g.param]: o.value })}
                  className={`${chipBase} ${active ? chipActive : chipIdle}`}
                  aria-current={active ? "true" : undefined}
                >
                  {o.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {anyActive && (
        <div className="flex justify-end">
          <Link
            href={buildHref(base, current, Object.fromEntries(groups.map((g) => [g.param, ""])))}
            className="font-mono text-[11px] text-white/35 underline-offset-2 transition hover:text-amber-300 hover:underline"
          >
            ✕ clear filters
          </Link>
        </div>
      )}
    </div>
  );
}

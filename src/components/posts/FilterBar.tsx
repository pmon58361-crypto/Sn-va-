import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────
// FilterBar — server-rendered chip groups for the job board.
// Every chip is a plain <Link> that patches ONE URL param while keeping the
// rest, so filtering works with zero client JS and stays shareable/bookmarkable.
// Soft pill styling in brand accent — no gradients, no mono hacker type.
// ─────────────────────────────────────────────────────────────────────────

export type FilterGroup = {
  /** Param key this group writes to. */
  param: string;
  /** Small-caps label shown next to the chips. */
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

function clearHref(base: string, current: CurrentParams, groups: FilterGroup[]) {
  return buildHref(
    base,
    current,
    Object.fromEntries(groups.map((g) => [g.param, ""]))
  );
}

const chipBase =
  "rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap touch-manipulation transition-colors sm:py-1.5";
const chipIdle =
  "border-line bg-soft text-ink-muted hover:border-line-strong hover:text-ink";
const chipActive =
  "border-accent bg-accent text-white shadow-sm hover:bg-accent-hover";
const groupLabel =
  "shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint";

export function FilterBar({
  base,
  current,
  groups,
  dense,
}: {
  /** Path to link to, e.g. "/jobs" or "/applications". */
  base: string;
  /** Currently active searchParams. */
  current: CurrentParams;
  groups: FilterGroup[];
  /** Compact single-row layout: all groups share one horizontal wrap row. */
  dense?: boolean;
}) {
  // Any filter actually set? Controls the "clear" chip.
  const anyActive = groups.some((g) => {
    const anyValue = g.options[0]?.value ?? "";
    return current[g.param] && current[g.param] !== anyValue;
  });
  const activeCount = groups.filter((g) => {
    const anyValue = g.options[0]?.value ?? "";
    const v = current[g.param];
    return v != null && v !== "" && v !== anyValue;
  }).length;

  if (dense) {
    return (
      <div className="mb-4 rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {groups.map((g) => (
            <span key={g.param} className="flex flex-wrap items-center gap-1.5">
              <span className={groupLabel}>{g.label}</span>
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
            </span>
          ))}
          {anyActive && (
            <Link
              href={clearHref(base, current, groups)}
              className="ml-auto rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-warm/50 hover:text-warm"
            >
              Clear ({activeCount})
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      {groups.map((g) => (
        <div key={g.param} className="flex flex-wrap items-center gap-2">
          <span className={`w-16 ${groupLabel}`}>{g.label}</span>
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
            href={clearHref(base, current, groups)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-warm/50 hover:text-warm"
          >
            Clear all filters
          </Link>
        </div>
      )}
    </div>
  );
}

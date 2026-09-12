import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────
// FilterBar — server-rendered chip groups for the job board.
// Every chip is a plain <Link> that patches ONE URL param while keeping the
// rest, so filtering works with zero client JS and stays shareable/bookmarkable.
// Collapsible via native <details> (no JS): opens automatically when any
// filter is active, rests collapsed otherwise. Tapping an ACTIVE chip
// clears just that group — no separate reset hunt.
// Soft pill styling in brand accent — no gradients, no mono hacker type.
// ─────────────────────────────────────────────────────────────────────────

export type FilterGroup = {
  /** Param key this group writes to. */
  param: string;
  /** Small-caps label shown next to the chips. */
  label: string;
  /** value → label options; options[0] is the default ("any"). */
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

function clearHref(
  base: string,
  current: CurrentParams,
  groups: FilterGroup[]
) {
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

function Chip({
  base,
  current,
  group,
  option,
  anyValue,
}: {
  base: string;
  current: CurrentParams;
  group: FilterGroup;
  option: { value: string; label: string };
  anyValue: string;
}) {
  const active = (current[group.param] || option.value) === option.value;
  const isDefault = option.value === anyValue;
  // Tapping the active non-default chip clears just its group.
  const href =
    active && !isDefault
      ? buildHref(base, current, { [group.param]: "" })
      : buildHref(base, current, { [group.param]: option.value });
  return (
    <Link
      href={href}
      className={`${chipBase} ${active ? chipActive : chipIdle}`}
      aria-current={active ? "true" : undefined}
      title={active && !isDefault ? `Clear ${group.label} filter` : option.label}
    >
      {option.label}
    </Link>
  );
}

function ClearButton({
  base,
  current,
  groups,
  activeCount,
}: {
  base: string;
  current: CurrentParams;
  groups: FilterGroup[];
  activeCount: number;
}) {
  return (
    <Link
      href={clearHref(base, current, groups)}
      className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-warm/50 hover:text-warm"
    >
      Clear{activeCount > 1 ? ` (${activeCount})` : ""}
    </Link>
  );
}

export function FilterBar({
  base,
  current,
  groups,
  dense,
  resultCount,
}: {
  /** Path to link to, e.g. "/jobs" or "/applications". */
  base: string;
  /** Currently active searchParams. */
  current: CurrentParams;
  groups: FilterGroup[];
  /** Compact single-row layout: all groups share one horizontal wrap row. */
  dense?: boolean;
  /** Total results for the current filter set (shown in header + footer). */
  resultCount?: number;
}) {
  const activeCount = groups.filter((g) => {
    const anyValue = g.options[0]?.value ?? "";
    const v = current[g.param];
    return v != null && v !== "" && v !== anyValue;
  }).length;
  const anyActive = activeCount > 0;

  return (
    <details
      open={anyActive || undefined}
      className="group mb-4 overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <summary className="flex cursor-pointer list-none touch-manipulation items-center gap-2 px-3 py-2.5 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-ink">Filters</span>
        {anyActive && (
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-bold tabular-nums text-accent">
            {activeCount}
          </span>
        )}
        {resultCount != null && (
          <span className="text-xs tabular-nums text-ink-faint">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="ml-auto h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>

      <div className={dense ? "px-3 pb-3" : "space-y-3 px-3 pb-3 sm:px-4"}>
        {groups.map((g) => {
          const anyValue = g.options[0]?.value ?? "";
          return dense ? (
            <span
              key={g.param}
              className="mr-4 inline-flex flex-wrap items-center gap-1.5 last:mr-0"
            >
              <span className={groupLabel}>{g.label}</span>
              {g.options.map((o) => (
                <Chip
                  key={o.value || "any"}
                  base={base}
                  current={current}
                  group={g}
                  option={o}
                  anyValue={anyValue}
                />
              ))}
            </span>
          ) : (
            <div key={g.param} className="flex flex-wrap items-center gap-2">
              <span className={`w-16 ${groupLabel}`}>{g.label}</span>
              <div className="flex flex-wrap items-center gap-2">
                {g.options.map((o) => (
                  <Chip
                    key={o.value || "any"}
                    base={base}
                    current={current}
                    group={g}
                    option={o}
                    anyValue={anyValue}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {anyActive && (
          <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
            <span className="text-xs text-ink-faint">
              {resultCount != null
                ? `${resultCount} result${resultCount === 1 ? "" : "s"} match`
                : "Filters on"}
            </span>
            <ClearButton
              base={base}
              current={current}
              groups={groups}
              activeCount={activeCount}
            />
          </div>
        )}
      </div>
    </details>
  );
}

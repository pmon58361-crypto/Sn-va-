"use client";

// Shared interest chip toggle used by the onboarding picker and the
// Settings interests editor. Purely presentational — selection state
// lives with the caller.
export function InterestChips({
  suggestions,
  selected,
  onToggle,
}: {
  suggestions: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const isPicked = (t: string) => selected.includes(t);
  return (
    <div
      role="group"
      aria-label="Topic suggestions"
      className="flex flex-wrap gap-2"
    >
      {suggestions.map((tag) => {
        const picked = isPicked(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={picked}
            onClick={() => onToggle(tag)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              picked
                ? "border-accent bg-accent-tint text-accent"
                : "border-line bg-surface text-ink-muted hover:border-accent hover:text-accent"
            }`}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
}

// Community feed loading skeleton. Mirrors community/page.tsx layout exactly
// (stories rail, composer, tab bar, topic chips, post cards) so nothing
// shifts when real content arrives.
export default function Loading() {
  return (
    <div className="flex" aria-busy="true" aria-label="Loading feed">
      <div className="mx-auto w-full max-w-[640px] px-4 py-5">
        {/* Stories rail */}
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="shrink-0 animate-pulse">
              <div className="h-16 w-16 rounded-full bg-surface ring-2 ring-line" />
              <div className="mx-auto mt-1.5 h-2 w-10 rounded bg-soft" />
            </div>
          ))}
        </div>

        <div className="h-4" />

        {/* Composer */}
        <div className="h-20 animate-pulse rounded-xl bg-surface" />

        {/* Feed tabs */}
        <div className="mt-4 grid grid-cols-2 border-b border-line">
          <div className="py-2.5 text-center">
            <span className="relative inline-block h-0 w-16 align-middle">
              <span className="absolute inset-x-0 bottom-[-11px] h-0.5 bg-accent" />
            </span>
          </div>
          <div className="py-2.5" />
        </div>

        {/* Topic chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["w-12", "w-16", "w-10", "w-14"].map((w, i) => (
            <div
              key={i}
              className={`h-6 animate-pulse rounded-full bg-soft ${w}`}
            />
          ))}
        </div>

        {/* Post cards */}
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((i) => (
            <article
              key={i}
              className="animate-pulse overflow-hidden rounded-2xl bg-surface p-4 sm:p-5"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-[34px] w-[34px] rounded-full bg-soft" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3 w-28 rounded bg-soft" />
                  <div className="h-2.5 w-20 rounded bg-soft" />
                </div>
                <div className="h-6 w-16 rounded-full bg-soft" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-4 w-2/3 rounded bg-soft" />
                <div className="h-3 w-full rounded bg-soft" />
                <div className="h-3 w-5/6 rounded bg-soft" />
              </div>
              <div className="mt-4 h-44 rounded-xl bg-soft" />
              <div className="mt-4 flex items-center gap-4">
                <div className="h-3 w-14 rounded bg-soft" />
                <div className="h-3 w-14 rounded bg-soft" />
                <div className="ml-auto h-3 w-16 rounded bg-soft" />
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Right sidebar placeholder — same footprint as RightSidebar */}
      <div
        className="hidden h-screen w-72 shrink-0 animate-pulse border-l border-line px-5 py-6 xl:block"
        aria-hidden="true"
      >
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-soft" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-[38px] w-[38px] shrink-0 rounded-full bg-surface" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 rounded bg-surface" />
                <div className="h-2.5 w-14 rounded bg-surface" />
              </div>
              <div className="h-7 w-16 rounded-full bg-surface" />
            </div>
          ))}
          <div className="mt-6 h-3 w-20 rounded bg-soft" />
          <div className="h-32 rounded-xl bg-surface" />
        </div>
      </div>
    </div>
  );
}

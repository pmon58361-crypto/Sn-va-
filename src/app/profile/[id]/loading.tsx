// Profile loading skeleton. Mirrors profile/[id]/page.tsx: max-w-3xl column,
// header card with accent banner + overlapping 96px avatar + name/handle rows,
// then two post-card placeholders.
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-3xl px-5 py-8"
      aria-busy="true"
      aria-label="Loading profile"
    >
      {/* Header card */}
      <section className="overflow-hidden rounded-2xl bg-surface">
        <div className="h-24 w-full animate-pulse bg-soft" />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-12 mb-4">
            <div className="h-24 w-24 animate-pulse rounded-full border-4 border-[var(--bg-elevated)] bg-soft" />
          </div>

          <div className="animate-pulse">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="h-6 w-40 rounded bg-soft" />
                <div className="h-3.5 w-24 rounded bg-soft" />
                <div className="mt-3 flex gap-2">
                  <div className="h-6 w-14 rounded-full bg-soft" />
                  <div className="h-6 w-20 rounded-full bg-soft" />
                </div>
              </div>
              <div className="h-10 w-28 shrink-0 rounded-full bg-soft" />
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-4 flex animate-pulse gap-6 border-t border-line pt-4">
            <div className="h-3 w-16 rounded bg-soft" />
            <div className="h-3 w-16 rounded bg-soft" />
            <div className="h-3 w-16 rounded bg-soft" />
          </div>
        </div>
      </section>

      {/* Posts */}
      <div className="mt-6 space-y-4">
        {[0, 1].map((i) => (
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
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 w-1/2 rounded bg-soft" />
              <div className="h-3 w-4/5 rounded bg-soft" />
            </div>
            <div className="mt-4 h-36 rounded-xl bg-soft" />
          </article>
        ))}
      </div>
    </div>
  );
}

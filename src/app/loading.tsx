// Generic root loading skeleton. Shown while any route segment without its
// own boundary resolves. Deliberately vague: a centered feed-width column
// of soft pulse blocks in the app's surface tones.
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-[640px] px-4 py-5"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-20 animate-pulse rounded-xl bg-surface" />
      <div className="mt-4 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-surface p-5">
            <div className="flex items-center gap-2.5">
              <div className="h-[34px] w-[34px] rounded-full bg-soft" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-soft" />
                <div className="h-2.5 w-16 rounded bg-soft" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-soft" />
              <div className="h-3 w-full rounded bg-soft" />
              <div className="h-3 w-5/6 rounded bg-soft" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

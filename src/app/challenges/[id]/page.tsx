import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPosts, reactionCounts } from "@/lib/queries";
import { isChallengeLive } from "@/lib/challenges";
import { PostCard } from "@/components/posts/PostCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const c = await prisma.challenge.findUnique({
      where: { id },
      select: { title: true },
    });
    return { title: c ? `${c.title} — Challenge` : "Challenge" };
  } catch {
    return { title: "Challenge" };
  }
}

function endsLabel(c: { endsAt: Date | null }) {
  if (!c.endsAt) return "Open — no deadline";
  const ms = c.endsAt.getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `Ends in ${days} days`;
  if (days >= 1) return "Ends tomorrow";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Ends in ${hours}h`;
  return "Ending soon";
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const meId = session?.user?.id;

  const challenge = await prisma.challenge
    .findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    .catch(() => null);
  if (!challenge) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-5">
        <div className="card p-6 text-center">
          <p className="text-sm font-semibold text-ink">Setting up…</p>
          <p className="mt-1 text-sm text-ink-muted">
            Challenges are still activating on this server — check back
            shortly.
          </p>
        </div>
      </div>
    );
  }

  const live = isChallengeLive(challenge);

  const entries = await getPosts({
    challengeId: challenge.id,
    viewerId: meId,
    sort: "new",
    limit: 50,
  });

  // Leaderboard: most likes first. Computed live from real reactions —
  // never stored, never faked.
  const ranked = [...entries].sort((a, b) => {
    const la = reactionCounts(a.reactions ?? []).likes;
    const lb = reactionCounts(b.reactions ?? []).likes;
    if (lb !== la) return lb - la;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-5">
      <section className="card p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Weekly challenge
        </p>
        <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {challenge.title}
        </h1>
        {challenge.prompt && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
            {challenge.prompt}
          </p>
        )}
        <p className="mt-3 font-mono text-xs text-ink-faint">
          {ranked.length} {ranked.length === 1 ? "entry" : "entries"} ·{" "}
          {endsLabel(challenge)}
        </p>
        {challenge.endsAt &&
          (() => {
            const total =
              challenge.endsAt!.getTime() - challenge.startsAt.getTime();
            const elapsed = Math.max(
              0,
              Date.now() - challenge.startsAt.getTime()
            );
            const pct =
              total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
            const day = Math.max(
              1,
              Math.ceil(elapsed / 86_400_000)
            );
            const days = Math.max(1, Math.ceil(total / 86_400_000));
            return (
              <div className="mt-3">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Day ${Math.min(day, days)} of ${days}`}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  Day {Math.min(day, days)} of {days}
                  {live && " — entries close when the bar fills"}
                </p>
              </div>
            );
          })()}
        {live &&
          (meId ? (
            <Link
              href={`/new?challenge=${challenge.id}`}
              className="btn-primary mt-4 inline-block px-4 py-2 text-sm"
            >
              Enter challenge
            </Link>
          ) : (
            <Link
              href={`/auth/signin?callbackUrl=/challenges/${challenge.id}`}
              className="btn-primary mt-4 inline-block px-4 py-2 text-sm"
            >
              Sign in to enter
            </Link>
          ))}
      </section>

      <div className="mt-5 space-y-4">
        {ranked.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-semibold text-ink">No entries yet.</p>
            <p className="mt-1 text-sm text-ink-muted">
              {live
                ? "Be the first — your post becomes entry #1."
                : "This challenge ended with no entries."}
            </p>
          </div>
        ) : (
          ranked.map((post, i) => (
            <div key={post.id}>
              {!live && i === 0 && (
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">
                  Top entry
                </p>
              )}
              <PostCard post={post} viewerId={meId} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { getActiveChallenge } from "@/lib/challenges";

/** Live-challenge banner for the community feed. Renders nothing when no
 *  challenge is running — the slot collapses entirely. */
export async function ChallengeBanner() {
  const challenge = await getActiveChallenge();
  if (!challenge) return null;

  return (
    <Link
      href={`/challenges/${challenge.id}`}
      className="card card-hover mt-4 block p-4"
    >
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
        Weekly challenge · {challenge._count.posts}{" "}
        {challenge._count.posts === 1 ? "entry" : "entries"}
      </p>
      <p className="mt-1 truncate text-[15px] font-bold text-ink">
        {challenge.title}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Tap to view the leaderboard and enter →
      </p>
    </Link>
  );
}

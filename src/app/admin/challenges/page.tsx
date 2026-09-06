import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChallengeManager } from "./ChallengeManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Challenges", robots: { index: false } };

export default async function AdminChallengesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "admin") redirect("/");

  const challenges = await prisma.challenge.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });

  const initial = challenges.map((c) => ({
    id: c.id,
    title: c.title,
    prompt: c.prompt,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    entries: c._count.posts,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <Link
          href="/admin"
          className="mb-2 inline-block text-sm text-ink-muted transition hover:text-accent"
        >
          ← Moderation
        </Link>
        <h1 className="text-xl font-bold text-ink">Weekly challenges</h1>
        <p className="text-sm text-ink-muted">
          Community contests. Entries are ordinary posts — deleting a
          challenge never destroys them.
        </p>
      </header>

      <ChallengeManager initial={initial} />
    </div>
  );
}

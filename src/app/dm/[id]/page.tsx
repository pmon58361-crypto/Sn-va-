import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getUserBrief, getThread, markThreadReadSafe } from "@/lib/dm";
import { DmThread } from "@/components/dm/DmThread";

export const dynamic = "force-dynamic";

// Per-conversation tab title: "DM with <name>" (template appends the brand).
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string; reply?: string; text?: string }>;
}) {
  // DMs are private conversations — never index them.
  const noindex = { robots: { index: false } } as const;
  // Per-conversation tab title: "DM with <name> — Snívať".
  const { id } = await params;
  try {
    const { getUserBrief } = await import("@/lib/dm");
    const other = await getUserBrief(id);
    if (other?.name) return { title: `DM with ${other.name} — Snívať`, ...noindex };
  } catch {}
  return { title: "DMs — Snívať", ...noindex };
}

export default async function DmThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string; reply?: string; text?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=/dm/${id}`);
  const meId = session.user.id;
  if (meId === id) redirect("/dm");

  const other = await getUserBrief(id);
  if (!other) notFound();

  // Story-reply / note quick-reply deep links may pre-fill the composer.
  const initialDraft = (sp.draft || sp.text || "").slice(0, 2000);

  const thread = await getThread(meId, id);
  // Opening the thread marks it read.
  await markThreadReadSafe(meId, id);

  const initial = thread.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    reactions: m.reactions.map((r) => ({
      messageId: m.id,
      userId: r.userId,
      emoji: r.emoji,
    })),
  }));

  return (
    <main className="flex h-[100dvh] flex-col">
      <div className="flex items-center gap-4 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur-md">
        <Link
          href="/dm"
          className="grid h-8 w-8 place-items-center rounded-full text-lg hover:bg-surface-hover"
        >
          ←
        </Link>
        <Link href={`/profile/${other.id}`} className="flex items-center gap-2.5">
          <AvatarSmall name={other.name} image={other.image} />
          <span>
            <span className="block text-[15px] font-bold leading-tight">
              {other.name || "Someone"}
            </span>
            <span className="block text-xs text-ink-secondary">View profile</span>
          </span>
        </Link>
      </div>

      {/* key: remount per conversation — fresh state + correct poll cursor */}
      <DmThread
        key={other.id}
        otherId={other.id}
        meId={meId}
        initial={initial}
        initialDraft={initialDraft}
        autoFocusComposer={sp.reply === "1"}
      />
    </main>
  );
}

function AvatarSmall({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-white">
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getConversations, getMessageableUsers } from "@/lib/dm";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "DMs — Snívať" };

export default async function DmPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/dm");
  const meId = session.user.id;

  const conversations = await getConversations(meId);
  const newPeople = await getMessageableUsers(meId);

  return (
    <main>
      <div className="sticky top-0 z-10 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md">
        <h1 className="text-xl font-extrabold">Messages</h1>
      </div>

      {conversations.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <h2 className="text-2xl font-extrabold">No conversations yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-secondary">
            Direct messages are private. Start one from a person&apos;s profile or
            from the list below.
          </p>
          <Link href="/people" className="btn-primary mt-6 inline-block">
            Find people
          </Link>
        </div>
      ) : (
        <div>
          {conversations.map((c) => (
            <Link
              key={c.other.id}
              href={`/dm/${c.other.id}`}
              className="flex items-center gap-3 border-b border-line px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <Avatar name={c.other.name} image={c.other.image} />
              <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-2 text-[15px] ${c.unread ? "font-bold" : "font-semibold"}`}>
                  <span className="truncate">{c.other.name || "Someone"}</span>
                  <span className="shrink-0 text-xs font-normal text-ink-secondary">
                    · {timeAgo(c.lastAt)}
                  </span>
                </span>
                <span className={`block truncate text-sm ${c.unread ? "text-ink" : "text-ink-secondary"}`}>
                  {c.lastFromMe && <span className="text-ink-faint">You: </span>}
                  {c.lastPreview}
                </span>
              </span>
              {c.unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {newPeople.length > 0 && (
        <section className="px-4 py-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-secondary">
            Start a conversation
          </h2>
          <div className="flex flex-wrap gap-2">
            {newPeople.map((u) => (
              <Link
                key={u.id}
                href={`/dm/${u.id}`}
                className="btn-outline items-center gap-2 !rounded-full px-3 py-1.5 text-sm"
              >
                <Avatar name={u.name} image={u.image} size={22} />
                {u.name || "Someone"}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}


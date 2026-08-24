import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Notifications", robots: { index: false } };
export const dynamic = "force-dynamic";

function postHref(category: string, postId: string) {
  const map: Record<string, string> = {
    COMMUNITY: `/community/${postId}`,
    JOB_OFFER: `/jobs/${postId}`,
    JOB_REQUEST: `/jobs/${postId}`,
    JOB_LISTING: `/applications/${postId}`,
  };
  return map[category] || `/community/${postId}`;
}

function textFor(type: string) {
  switch (type) {
    case "comment":
      return "commented on your post";
    case "like":
      return "liked your post";
    case "follow":
      return "started following you";
    case "application":
      return "applied to your listing";
    case "application_accepted":
      return "accepted your application";
    case "application_rejected":
      return "rejected your application";
    case "message":
      return "sent you a message";
    default:
      return type;
  }
}

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const meId = session.user.id;

  const items = await prisma.notification.findMany({
    where: { userId: meId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { id: true, name: true, image: true } },
      post: { select: { id: true, category: true, title: true } },
    },
  });

  // Opening the inbox marks everything as read.
  if (items.some((n) => !n.read)) {
    await prisma.notification.updateMany({
      where: { userId: meId, read: false },
      data: { read: true },
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold">Notifications</h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-lg font-semibold">All caught up</p>
          <p className="mt-1 text-sm text-ink-muted">
            Likes, comments, follows, applications and messages will land
            here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((n) => {
            const href =
              n.type === "follow"
                ? n.actorId
                  ? `/profile/${n.actorId}`
                  : "/notifications"
                : n.type === "message"
                ? n.actorId
                  ? `/dm/${n.actorId}`
                  : "/dm"
                : n.post
                ? postHref(n.post.category, n.post.id)
                : "/notifications";

            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg"
                  style={
                    n.read ? undefined : { backgroundColor: "var(--accent-tint)" }
                  }
                >
                  <Avatar name={n.actor?.name} image={n.actor?.image} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-bold">{n.actor?.name || "Someone"}</span>{" "}
                      <span className="text-ink-muted">{textFor(n.type)}</span>
                      {n.post && (
                        <span className="text-ink-muted"> — {n.post.title}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-accent"
                      aria-label="unread"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

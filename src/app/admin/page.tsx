import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import {
  dismissReports,
  removeTarget,
  deletePostPermanently,
  banUser,
  unbanUser,
  type AdminTargetType,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation — Snívať" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.role !== "admin") redirect("/");

  const [openReports, hiddenPosts, stats] = await Promise.all([
    prisma.report.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { id: true, name: true, image: true } },
        post: {
          include: {
            author: { select: { id: true, name: true, bannedAt: true } },
            _count: { select: { reports: true } },
          },
        },
        comment: {
          include: {
            author: { select: { id: true, name: true, bannedAt: true } },
            post: { select: { id: true, category: true } },
          },
        },
        message: {
          include: {
            sender: { select: { id: true, name: true, bannedAt: true } },
          },
        },
        story: {
          include: {
            author: { select: { id: true, name: true, bannedAt: true } },
          },
        },
      },
    }),
    prisma.post.findMany({
      where: { hidden: true },
      orderBy: { updatedAt: "desc" },
      include: {
        author: { select: { id: true, name: true, bannedAt: true } },
        _count: { select: { reports: true } },
      },
    }),
    Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.report.count({ where: { status: "open" } }),
      prisma.post.count({ where: { hidden: true } }),
    ]),
  ]);

  const [userCount, postCount, reportCount, hiddenCount] = stats;

  // Free Cloudinary admin API — quota visibility without leaving the app.
  // Best-effort: a missing/failing CLOUDINARY_URL must not break moderation.
  type Usage = {
    credits?: { usage?: number; limit?: number };
    storage?: { usage?: number; limit?: number };
    resources?: number;
  };
  let usage: Usage | null = null;
  try {
    if (process.env.CLOUDINARY_URL) {
      usage = (await cloudinary.api.usage()) as Usage;
    }
  } catch {
    /* render nothing */
  }

  // Group open reports by target so one card = one piece of content.
  type Group = {
    targetType: AdminTargetType;
    targetId: string;
    reports: (typeof openReports)[number][];
    preview: string | null;
    authorName: string;
    authorId: string | null;
    authorBanned: boolean;
    href: string | null;
    alreadyHidden: boolean;
  };
  const groups = new Map<string, Group>();

  for (const r of openReports) {
    const key = `${r.targetType}:${r.postId ?? r.commentId ?? r.messageId ?? r.storyId}`;
    let g = groups.get(key);
    if (!g) {
      const t =
        r.targetType === "POST"
          ? r.post
          : r.targetType === "COMMENT"
          ? r.comment
          : r.targetType === "MESSAGE"
          ? r.message
          : r.story;
      if (!t) continue; // dangling report (target deleted) — skip

      const authorRel =
        r.targetType === "POST"
          ? r.post!.author
          : r.targetType === "COMMENT"
          ? r.comment!.author
          : r.targetType === "MESSAGE"
          ? r.message!.sender
          : r.story!.author;

      const preview =
        r.targetType === "POST"
          ? `${r.post!.title} — ${r.post!.content.slice(0, 140)}`
          : r.targetType === "STORY"
          ? r.story!.caption || "(photo story)"
          : ("content" in t ? String((t as { content?: string }).content ?? "") : "").slice(0, 160) ||
            "(media)";

      g = {
        targetType: r.targetType as AdminTargetType,
        targetId: t.id,
        reports: [],
        preview,
        authorName: authorRel?.name || "Someone",
        authorId: authorRel?.id ?? null,
        authorBanned: !!authorRel?.bannedAt,
        href:
          r.targetType === "POST"
            ? `/${sectionPath(r.post!.category)}/${r.post!.id}`
            : r.targetType === "COMMENT" && r.comment?.post
            ? `/${sectionPath(r.comment.post.category)}/${r.comment.post.id}`
            : null,
        alreadyHidden:
          r.targetType === "POST" ? !!r.post!.hidden : false,
      };
      groups.set(key, g);
    }
    g.reports.push(r);
  }

  const queue = Array.from(groups.values()).sort(
    (a, b) => b.reports.length - a.reports.length
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-ink">Moderation</h1>
        <p className="text-sm text-ink-muted">
          Reports from the community. Nothing is automatic beyond the hide
          threshold — you decide what stays.
        </p>
      </header>

      {/* Stats strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Members" value={userCount} />
        <Stat label="Posts" value={postCount} />
        <Stat label="Open reports" value={reportCount} highlight={reportCount > 0} />
        <Stat label="Hidden posts" value={hiddenCount} />
      </div>

      {/* Report queue */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Report queue ({queue.length})
        </h2>

        {queue.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm text-ink-muted">
              No open reports. Quiet day.
            </p>
          </div>
        )}

        {queue.map((g) => (
          <article key={`${g.targetType}:${g.targetId}`} className="card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="badge bg-accent-tint font-bold text-accent">
                {g.reports.length}{" "}
                {g.reports.length === 1 ? "report" : "reports"}
              </span>
              <span className="font-semibold text-ink">{g.authorName}</span>
              <span className="rounded border border-line px-1.5 py-0.5 text-[11px] uppercase text-ink-faint">
                {g.targetType}
              </span>
              {g.alreadyHidden && (
                <span className="badge bg-warm/15 text-xs text-warm">hidden</span>
              )}
              {g.authorBanned && (
                <span className="badge bg-warm/15 text-xs text-warm">author banned</span>
              )}
            </div>

            <p className="whitespace-pre-wrap break-words rounded-lg bg-soft p-3 text-sm text-ink">
              {g.preview}
              {g.href && (
                <>
                  {" "}
                  <Link href={g.href} className="ml-1 inline-block align-baseline text-accent hover:underline">
                    view →
                  </Link>
                </>
              )}
            </p>

            <ul className="mt-2 space-y-0.5 text-xs text-ink-faint">
              {g.reports.slice(0, 5).map((r) => (
                <li key={r.id}>
                  “{truncate(r.reason, 120)}” — {r.reporter.name || "someone"}
                  , {new Date(r.createdAt).toLocaleDateString()}
                </li>
              ))}
              {g.reports.length > 5 && (
                <li>+{g.reports.length - 5} more…</li>
              )}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <form action={dismissForm(g.targetType, g.targetId)}>
                <button className="btn-outline px-3 py-1.5 text-xs" type="submit">
                  Dismiss — keep visible
                </button>
              </form>
              {!g.alreadyHidden && g.targetType === "POST" && (
                <form action={removeForm(g.targetType, g.targetId)}>
                  <button className="btn-outline px-3 py-1.5 text-xs !border-warm !text-warm" type="submit">
                    Hide post
                  </button>
                </form>
              )}
              {g.targetType !== "POST" && (
                <form action={removeForm(g.targetType, g.targetId)}>
                  <button className="btn-outline px-3 py-1.5 text-xs !border-warm !text-warm" type="submit">
                    Delete {g.targetType.toLowerCase()}
                  </button>
                </form>
              )}
              {g.targetType === "POST" && (
                <form action={deletePostForm(g.targetId)}>
                  <button
                    className="btn-outline px-3 py-1.5 text-xs !border-warm !bg-warm/10 !text-warm"
                    type="submit"
                    title="Hard-deletes the post and its images"
                  >
                    Delete forever
                  </button>
                </form>
              )}
              {g.authorId && !g.authorBanned && (
                <form action={banForm(g.authorId)}>
                  <button className="btn-outline ml-auto px-3 py-1.5 text-xs" type="submit">
                    Ban author
                  </button>
                </form>
              )}
              {g.authorId && g.authorBanned && (
                <form action={unbanForm(g.authorId)}>
                  <button className="btn-outline ml-auto px-3 py-1.5 text-xs" type="submit">
                    Unban author
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Auto-hidden / previously removed posts */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Hidden posts ({hiddenPosts.length})
        </h2>
        {hiddenPosts.length === 0 ? (
          <p className="card p-6 text-center text-sm text-ink-muted">
            Nothing hidden right now.
          </p>
        ) : (
          <div className="space-y-2">
            {hiddenPosts.map((p) => (
              <div
                key={p.id}
                className="card flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm"
              >
                <Link
                  href={`/${sectionPath(p.category)}/${p.id}`}
                  className="min-w-0 flex-1 truncate font-medium text-ink hover:text-accent"
                >
                  {p.title}
                </Link>
                <span className="text-xs text-ink-faint">
                  by {p.author.name || "someone"} · {p._count.reports}{" "}
                  {p._count.reports === 1 ? "report" : "reports"}
                </span>
                <form action={dismissForm("POST", p.id)}>
                  <button className="btn-outline px-2.5 py-1 text-xs" type="submit">
                    Restore
                  </button>
                </form>
                <form action={deletePostForm(p.id)}>
                  <button
                    className="btn-outline px-2.5 py-1 text-xs !border-warm !text-warm"
                    type="submit"
                  >
                    Delete forever
                  </button>
                </form>
                {p.authorId && !p.author.bannedAt && (
                  <form action={banForm(p.author.id)}>
                    <button className="btn-outline px-2.5 py-1 text-xs" type="submit">
                      Ban
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Storage glance */}
      {usage && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
            Image storage
          </h2>
          <div className="card grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-lg font-bold text-ink">
                {(usage.resources ?? 0).toLocaleString()}
              </p>
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                stored assets
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-ink">
                {fmtBytes(usage.storage?.usage)}
              </p>
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                storage used
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-ink">
                {usage.credits?.usage != null && usage.credits?.limit
                  ? `${Math.round((usage.credits.usage / usage.credits.limit) * 100)}%`
                  : "—"}
              </p>
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                monthly quota
              </p>
            </div>
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-xs text-ink-faint">
        Database quota lives in your Neon console. Deleted content frees its
        images automatically.
      </p>
    </div>
  );
}

// ── Server-action form adapters ──────────────────────────────────────────────

function dismissForm(targetType: AdminTargetType, targetId: string) {
  return async () => {
    "use server";
    await dismissReports(targetType, targetId);
  };
}

function removeForm(targetType: AdminTargetType, targetId: string) {
  return async () => {
    "use server";
    await removeTarget(targetType, targetId);
  };
}

function deletePostForm(postId: string) {
  return async () => {
    "use server";
    await deletePostPermanently(postId);
  };
}

function banForm(userId: string) {
  return async () => {
    "use server";
    await banUser(userId);
  };
}

function unbanForm(userId: string) {
  return async () => {
    "use server";
    await unbanUser(userId);
  };
}

function sectionPath(category: string): string {
  const map: Record<string, string> = {
    COMMUNITY: "/community",
    JOB_OFFER: "/jobs",
    JOB_REQUEST: "/jobs",
    JOB_LISTING: "/applications",
  };
  return map[category] || "/community";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function fmtBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 1 ? 1 : 0)} ${units[i]}`;
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="card p-4">
      <dd
        className={`text-xl font-bold ${highlight ? "text-warm" : "text-ink"}`}
      >
        {value}
      </dd>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
    </div>
  );
}

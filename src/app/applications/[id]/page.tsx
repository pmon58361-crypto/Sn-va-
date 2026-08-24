import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPost } from "@/lib/queries";
import { PostDetail } from "@/components/posts/PostDetail";
import { ApplyForm } from "@/components/posts/ApplyForm";
import { Avatar } from "@/components/ui/Avatar";
import { MailIcon } from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils";
import { ApplicationActions } from "./ApplicationActions";
import { buildPostMetadata } from "@/lib/og";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return {};
  return buildPostMetadata({
    title: post.title,
    content: post.content,
    imageUrl: post.images[0]?.url,
    hidden: post.hidden,
  }, `/applications/${id}`);
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  // Post fetch + "did I apply" check are independent — one round trip.
  const [post, existing] = await Promise.all([
    getPost(id, session?.user?.id),
    session?.user?.id
      ? prisma.application.findUnique({
          where: { postId_userId: { postId: id, userId: session.user.id } },
          select: { status: true },
        })
      : Promise.resolve(null),
  ]);

  if (!post || post.category !== "JOB_LISTING") notFound();

  const meId = session?.user?.id;
  const isOwner = meId === post.authorId;

  // Hidden by moderation: only the author and admins may open the page.
  if (post.hidden) {
    const isAdmin = session?.user?.role === "admin";
    if (!isOwner && !isAdmin) notFound();
  }

  const hasApplied = !!existing;
  const myStatus: string | undefined = existing?.status;

  // Owner sees all applicants
  type ApplicationWithUser = {
    id: string;
    createdAt: Date;
    userId: string;
    status: string;
    postId: string;
    message: string;
    user: { id: string; name: string | null; image: string | null; email: string };
  };

  let applications: ApplicationWithUser[] = [];
  if (isOwner) {
    applications = await prisma.application.findMany({
      where: { postId: id },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {post.hidden && (
        <div className="mb-4 rounded-lg border border-warm/40 bg-warm/10 px-4 py-3 text-sm text-ink">
          This listing is <strong>hidden</strong> pending moderator review. Only
          you{session?.user?.role === "admin" ? " (admin)" : ""} can see it.
        </div>
      )}
      <PostDetail post={post} viewerId={meId} />

      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {isOwner ? `Applicants (${applications.length})` : "Apply for this job"}
        </h2>

        {isOwner ? (
          applications.length === 0 ? (
              <p className="card p-6 text-center text-sm text-ink-faint">
                No applicants yet — share the listing so the right people see
                it.
              </p>
          ) : (
            <div className="space-y-3">
              {applications.map((a) => (
                <div key={a.id} className="card p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <Avatar name={a.user.name} image={a.user.image} size={36} />
                    <div className="leading-tight">
                      <Link
                        href={`/profile/${a.user.id}`}
                        className="text-sm font-semibold text-ink hover:text-accent"
                      >
                        {a.user.name || "Applicant"}
                      </Link>
                      <p className="text-xs text-ink-faint">
                        Applied {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </div>
                  {a.message && (
                    <p className="whitespace-pre-wrap rounded-lg bg-soft px-3 py-2 text-sm text-ink-soft">
                      {a.message}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-ink-faint">
                    <MailIcon className="h-3.5 w-3.5" />
                    {a.user.email}
                  </div>
                  {a.status === "pending" ? (
                    <ApplicationActions applicationId={a.id} />
                  ) : (
                    <div className="mt-3">
                      <span
                        className={`badge text-xs font-semibold ${
                          a.status === "accepted"
                            ? "bg-accent-tint text-accent"
                            : "bg-soft text-ink-muted"
                        }`}
                      >
                        {a.status === "accepted" ? "Accepted" : "Rejected"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <ApplyForm
            postId={post.id}
            hasApplied={hasApplied}
            myStatus={myStatus}
            isOwner={false}
          />
        )}
      </section>
    </div>
  );
}


import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPost } from "@/lib/queries";
import { PostDetail } from "@/components/posts/PostDetail";
import { ApplyForm } from "@/components/posts/ApplyForm";
import { Avatar } from "@/components/ui/Avatar";
import { MailIcon } from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post || post.category !== "JOB_LISTING") notFound();

  const session = await auth();
  const isOwner = session?.user?.id === post.authorId;

  // Did the current user already apply?
  let hasApplied = false;
  if (session?.user?.id) {
    const existing = await prisma.application.findUnique({
      where: { postId_userId: { postId: id, userId: session.user.id } },
      select: { id: true },
    });
    hasApplied = !!existing;
  }

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
      <PostDetail post={post} viewerId={session?.user?.id} />

      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {isOwner ? `Applicants (${applications.length})` : "Apply for this job"}
        </h2>

        {isOwner ? (
          applications.length === 0 ? (
            <p className="card p-6 text-center text-sm text-ink-faint">
              No applicants yet.
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
                </div>
              ))}
            </div>
          )
        ) : (
          <ApplyForm postId={post.id} hasApplied={hasApplied} isOwner={false} />
        )}
      </section>
    </div>
  );
}

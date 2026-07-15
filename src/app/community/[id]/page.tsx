import { notFound } from "next/navigation";
import { getPost, getComments } from "@/lib/queries";
import { PostDetail, CommentList } from "@/components/posts/PostDetail";
import { CommentComposer } from "@/components/posts/CommentComposer";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, session] = await Promise.all([getPost(id), auth()]);

  if (!post || post.category !== "COMMUNITY") notFound();

  const comments = await getComments(id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PostDetail post={post} viewerId={session?.user?.id} />

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          Discussion ({comments.length})
        </h2>
        <div className="mb-6">
          <CommentComposer postId={post.id} />
        </div>
        <CommentList comments={comments} />
      </section>
    </div>
  );
}

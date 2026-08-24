import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPost, getComments } from "@/lib/queries";
import { PostDetail, CommentList } from "@/components/posts/PostDetail";
import { CommentComposer } from "@/components/posts/CommentComposer";
import { auth } from "@/auth";
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
  }, `/community/${id}`);
}

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, session] = await Promise.all([getPost(id), auth()]);

  if (!post || post.category !== "COMMUNITY") notFound();

  // Hidden by moderation: only the author and admins may open the page.
  if (post.hidden) {
    const isOwner = session?.user?.id === post.authorId;
    const isAdmin = session?.user?.role === "admin";
    if (!isOwner && !isAdmin) notFound();
  }

  const comments = await getComments(id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {post.hidden && (
        <div className="mb-4 rounded-lg border border-warm/40 bg-warm/10 px-4 py-3 text-sm text-ink">
          This post is <strong>hidden</strong> pending moderator review. Only
          you{session?.user?.role === "admin" ? " (admin)" : ""} can see it.
        </div>
      )}
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


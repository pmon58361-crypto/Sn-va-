import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PostComposer } from "@/components/posts/PostComposer";
import type { PostInput } from "@/app/actions";
import {
  POST_CATEGORIES,
  type PostCategory,
} from "@/lib/types";

export const metadata = { title: "New post", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; edit?: string; group?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/new");

  const { category, edit, group } = await searchParams;

  // Group posting: verify membership up-front so the composer can promise it.
  let groupName: string | undefined;
  let groupId: string | undefined;
  if (group && !edit) {
    const g = await prisma.group.findUnique({
      where: { id: group },
      select: { id: true, name: true, members: { where: { userId: session.user.id }, select: { userId: true } } },
    });
    if (g && g.members.length > 0) {
      groupId = g.id;
      groupName = g.name;
    }
  }

  // Edit mode: load the post and verify ownership before offering it.
  let postId: string | undefined;
  let initial: Partial<PostInput> | undefined;
  if (edit) {
    const post = await prisma.post.findUnique({
      where: { id: edit },
      select: {
        id: true,
        authorId: true,
        category: true,
        title: true,
        content: true,
        tags: true,
        budget: true,
        location: true,
        type: true,
        images: { select: { url: true }, orderBy: { order: "asc" } },
      },
    });
    if (!post || post.authorId !== session.user.id) {
      redirect("/community");
    }
    postId = post.id;
    initial = {
      category: post.category as PostCategory,
      title: post.title,
      content: post.content,
      tags: post.tags || "",
      budget: post.budget || "",
      location: post.location || "",
      type: post.type || "",
      imageUrls: post.images.map((i) => i.url),
    };
  }

  const composerInitial = initial ?? (POST_CATEGORIES.includes(category as PostCategory)
    ? { category: category as PostCategory }
    : undefined);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">
        {postId ? "Edit post" : "New post"}
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        {postId
          ? "Update your post — changes go live immediately."
          : "Share an experience, offer your skills, or post an opening."}
      </p>

      <PostComposer
        initial={composerInitial}
        postId={postId}
        lockedCategory={postId ? (initial!.category as PostCategory) : undefined}
        groupId={groupId}
      />
    </div>
  );
}

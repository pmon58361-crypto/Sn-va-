"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  POST_CATEGORIES,
  MAX_IMAGES_PER_POST,
  type PostCategory,
} from "@/lib/types";

function sectionPath(category: string) {
  const map: Record<string, string> = {
    COMMUNITY: "/community",
    JOB_OFFER: "/jobs",
    JOB_REQUEST: "/jobs",
    JOB_LISTING: "/applications",
  };
  return map[category] || "/community";
}

export type PostInput = {
  id?: string;
  category: PostCategory;
  title: string;
  content: string;
  tags?: string;
  budget?: string;
  location?: string;
  type?: string;
  imageUrls: string[];
};

export async function savePost(input: PostInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Basic validation
  if (!POST_CATEGORIES.includes(input.category)) {
    throw new Error("Invalid category");
  }
  if (!input.title.trim() || !input.content.trim()) {
    throw new Error("Title and content are required");
  }
  if (input.imageUrls.length > MAX_IMAGES_PER_POST) {
    throw new Error(`Max ${MAX_IMAGES_PER_POST} images per post`);
  }

  const data = {
    category: input.category,
    title: input.title.trim(),
    content: input.content.trim(),
    tags: input.tags?.trim() || null,
    budget: input.budget?.trim() || null,
    location: input.location?.trim() || null,
    type: input.type?.trim() || null,
  };

  if (input.id) {
    // Update existing — pin to a local const so TS narrows the type from
    // string | undefined to string (input is a parameter and not narrowed).
    const postId = input.id;
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!existing || existing.authorId !== session.user.id) {
      throw new Error("Not found or forbidden");
    }
    await prisma.post.update({
      where: { id: postId },
      data,
    });
    // Replace images
    await prisma.postImage.deleteMany({ where: { postId } });
    if (input.imageUrls.length) {
      await prisma.postImage.createMany({
        data: input.imageUrls.map((url, i) => ({
          postId,
          url,
          order: i,
        })),
      });
    }
    revalidatePath(sectionPath(input.category));
    redirect(`${sectionPath(input.category)}/${postId}`);
  } else {
    // Create new
    const post = await prisma.post.create({
      data: { ...data, authorId: session.user.id },
    });
    if (input.imageUrls.length) {
      await prisma.postImage.createMany({
        data: input.imageUrls.map((url, i) => ({
          postId: post.id,
          url,
          order: i,
        })),
      });
    }
    revalidatePath(sectionPath(input.category));
    redirect(`${sectionPath(input.category)}/${post.id}`);
  }
}

export async function deletePost(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true, category: true },
  });
  if (!post) throw new Error("Not found");
  if (post.authorId !== session.user.id) throw new Error("Forbidden");

  await prisma.post.delete({ where: { id } });
  revalidatePath(sectionPath(post.category));
  redirect(sectionPath(post.category));
}

export async function addComment(postId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!content.trim()) throw new Error("Comment required");

  await prisma.comment.create({
    data: { postId, authorId: session.user.id, content: content.trim() },
  });
  revalidatePath(`/community/${postId}`);
  revalidatePath(`/jobs/${postId}`);
  revalidatePath(`/applications/${postId}`);
}

export async function applyToJob(postId: string, message: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { category: true, status: true },
  });
  if (!post || post.category !== "JOB_LISTING") {
    throw new Error("Invalid listing");
  }
  if (post.status !== "open") throw new Error("Listing closed");

  // upsert prevents double-applications (unique [postId, userId])
  await prisma.application.upsert({
    where: { postId_userId: { postId, userId: session.user.id } },
    update: { message: message.trim() },
    create: { postId, userId: session.user.id, message: message.trim() },
  });
  revalidatePath(`/applications/${postId}`);
}

// Toggle a heart (like) on a post. One per user per post. Click again to remove.
export async function toggleReaction(postId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await prisma.reaction.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: { postId, userId: session.user.id, type: "like" },
    });
  }

  revalidatePath(`/community`);
  revalidatePath(`/community/${postId}`);
  revalidatePath(`/jobs`);
  revalidatePath(`/jobs/${postId}`);
  revalidatePath(`/applications`);
  revalidatePath(`/applications/${postId}`);
  revalidatePath(`/`);
}

export async function togglePostStatus(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true, status: true, category: true },
  });
  if (!post || post.authorId !== session.user.id) throw new Error("Forbidden");

  await prisma.post.update({
    where: { id },
    data: { status: post.status === "open" ? "closed" : "open" },
  });
  revalidatePath(sectionPath(post.category));
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
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

  // Notify the post author (skipped when you comment on your own post).
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (post) {
    await createNotification({
      userId: post.authorId,
      actorId: session.user.id,
      type: "comment",
      postId,
    });
  }

  revalidatePath(`/community/${postId}`);
  revalidatePath(`/jobs/${postId}`);
  revalidatePath(`/applications/${postId}`);
}

export async function applyToJob(postId: string, message: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { category: true, status: true, authorId: true },
  });
  if (!post || post.category !== "JOB_LISTING") {
    throw new Error("Invalid listing");
  }
  if (post.status !== "open") throw new Error("Listing closed");
  if (post.authorId === session.user.id) {
    throw new Error("You cannot apply to your own listing");
  }

  // upsert prevents double-applications (unique [postId, userId])
  const wasNew = !(await prisma.application.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
    select: { id: true },
  }));
  await prisma.application.upsert({
    where: { postId_userId: { postId, userId: session.user.id } },
    update: { message: message.trim() },
    create: { postId, userId: session.user.id, message: message.trim() },
  });

  // Notify the listing author on a first-time application only.
  if (wasNew) {
    const full = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (full) {
      await createNotification({
        userId: full.authorId,
        actorId: session.user.id,
        type: "application",
        postId,
      });
    }
  }

  revalidatePath(`/applications/${postId}`);
}

// Toggle a heart (like) on a post. One per user per post. Click again to remove.
// Toggle "like" (heart) or "dislike" (heartbreak). Mutually exclusive:
// reacting with one removes the other. Same type again = remove.
export async function toggleReaction(
  postId: string,
  type: "like" | "dislike" = "like"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;

  const existing = await prisma.reaction.findUnique({
    where: { postId_userId: { postId, userId: me } },
  });

  if (!existing) {
    await prisma.reaction.create({ data: { postId, userId: me, type } });
    // Notify the author on likes only (not dislikes).
    if (type === "like") {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
      if (post) {
        await createNotification({
          userId: post.authorId,
          actorId: me,
          type: "like",
          postId,
        });
      }
    }
  } else if (existing.type === type) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.update({ where: { id: existing.id }, data: { type } });
  }

  revalidatePath(`/community`);
  revalidatePath(`/community/${postId}`);
  revalidatePath(`/jobs`);
  revalidatePath(`/jobs/${postId}`);
  revalidatePath(`/applications`);
  revalidatePath(`/applications/${postId}`);
  revalidatePath(`/`);
}

// Bookmark / unbookmark a post.
export async function toggleBookmark(postId: string): Promise<{ bookmarked: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) throw new Error("Post not found");

  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId: me, postId } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }
  await prisma.bookmark.create({ data: { userId: me, postId } });
  return { bookmarked: true };
}

// Follow / unfollow a user.
export async function toggleFollow(targetUserId: string): Promise<{ following: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;
  if (me === targetUserId) throw new Error("Cannot follow yourself");

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) throw new Error("User not found");

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: me, followingId: targetUserId } },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return { following: false };
  }
  await prisma.follow.create({
    data: { followerId: me, followingId: targetUserId },
  });
  await createNotification({
    userId: targetUserId,
    actorId: me,
    type: "follow",
  });
  revalidatePath(`/profile/${targetUserId}`);
  return { following: true };
}

// Accept or reject a job application. Only the listing author decides.
export async function setApplicationStatus(
  applicationId: string,
  status: "accepted" | "rejected"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (status !== "accepted" && status !== "rejected") {
    throw new Error("Invalid status");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { post: { select: { id: true, authorId: true } } },
  });
  if (!application) throw new Error("Not found");
  if (application.post.authorId !== session.user.id) throw new Error("Forbidden");

  await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  // The applicant finds out the moment a decision is made.
  await createNotification({
    userId: application.userId,
    actorId: session.user.id,
    type: status === "accepted" ? "application_accepted" : "application_rejected",
    postId: application.post.id,
  });

  revalidatePath(`/applications/${application.post.id}`);
}

// Report a post for moderation. One report per user per post.
export async function reportPost(postId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) throw new Error("Post not found");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Reason required");

  await prisma.report.upsert({
    where: { postId_reporterId: { postId, reporterId: session.user.id } },
    update: { reason: trimmed },
    create: { postId, reporterId: session.user.id, reason: trimmed },
  });
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


import { prisma } from "@/lib/prisma";
import type { PostCategory } from "@/lib/types";

// Standard include shape so all post fetches return a consistent object.
const postInclude = {
  author: {
    select: { id: true, name: true, image: true, location: true },
  },
  images: { select: { id: true, url: true, order: true }, orderBy: { order: "asc" } },
  reactions: { select: { id: true, type: true, userId: true } },
  _count: { select: { comments: true, applications: true, images: true } },
} as const;

export function reactionCounts(reactions: { type: string }[] = []) {
  return {
    likes: reactions.filter((r) => r.type === "like").length,
    dislikes: reactions.filter((r) => r.type === "dislike").length,
  };
}

export type PostWithRelations = Awaited<
  ReturnType<typeof prisma.post.findFirst>
> & {
  author: { id: string; name: string | null; image: string | null; location: string | null } | null;
  images: { id: string; url: string; order: number }[];
  reactions: { id: string; type: string; userId: string }[];
  _count: { comments: number; applications: number; images: number };
};

export async function getPost(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });
}

export async function getPosts({
  category,
  categories,
  authorId,
  search,
  limit = 50,
  includeClosed = false,
}: {
  category?: PostCategory;
  categories?: PostCategory[];
  authorId?: string;
  search?: string;
  limit?: number;
  includeClosed?: boolean;
} = {}) {
  const where: Record<string, unknown> = {};

  if (category) where.category = category;
  if (categories && categories.length) where.category = { in: categories };

  if (authorId) where.authorId = authorId;

  if (!includeClosed) where.status = "open";

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { content: { contains: search } },
      { tags: { contains: search } },
    ];
  }

  return prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

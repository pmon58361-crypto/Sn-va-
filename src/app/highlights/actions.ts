"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Create a highlight from a set of uploaded image URLs. Cover = first image.
export async function createHighlight(input: {
  title: string;
  imageUrls: string[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;

  const title = input.title.trim();
  if (!title || title.length > 40) {
    return { ok: false, error: "Give it a short name (max 40 chars)" };
  }
  const urls = input.imageUrls.filter(Boolean).slice(0, 20);
  if (urls.length === 0) {
    return { ok: false, error: "Add at least one photo" };
  }

  const highlight = await prisma.highlight.create({
    data: {
      userId: me,
      title,
      coverUrl: urls[0],
      items: {
        create: urls.map((imageUrl) => ({ imageUrl })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/profile/" + me);
  return { ok: true, id: highlight.id };
}

// Delete a highlight (owner only).
export async function deleteHighlight(id: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const result = await prisma.highlight.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) throw new Error("Not found");

  revalidatePath("/profile/" + session.user.id);
  return { ok: true };
}

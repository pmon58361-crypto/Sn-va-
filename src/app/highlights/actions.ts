"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { destroyAssets } from "@/lib/storage";

// Create a highlight from a set of uploaded image URLs. Cover = first image.
export async function createHighlight(input: {
  title: string;
  imageUrls: string[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const me = (await requireActiveUser()).id;

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

// Delete a highlight (owner only). Uploads are freed only when nothing
// else references them — highlight items can reuse story/post image URLs.
export async function deleteHighlight(id: string): Promise<{ ok: boolean }> {
  const me = (await requireActiveUser()).id;

  const highlight = await prisma.highlight.findUnique({
    where: { id },
    select: {
      userId: true,
      coverUrl: true,
      items: { select: { imageUrl: true } },
    },
  });
  if (!highlight || highlight.userId !== me) {
    throw new Error("Not found");
  }

  await prisma.highlight.delete({ where: { id } });

  const candidates = Array.from(
    new Set(
      [highlight.coverUrl, ...highlight.items.map((i) => i.imageUrl)].filter(
        (u): u is string => !!u
      )
    )
  );

  if (candidates.length) {
    // Keep any URL still referenced by a story, a post image, another
    // item, or another highlight's cover.
    const [stories, postImgs, otherItems, otherCovers] = await Promise.all([
      prisma.story.findMany({
        where: { imageUrl: { in: candidates } },
        select: { imageUrl: true },
      }),
      prisma.postImage.findMany({
        where: { url: { in: candidates } },
        select: { url: true },
      }),
      prisma.highlightItem.findMany({
        where: { imageUrl: { in: candidates } },
        select: { imageUrl: true },
      }),
      prisma.highlight.findMany({
        where: { coverUrl: { in: candidates }, id: { not: id } },
        select: { coverUrl: true },
      }),
    ]);

    const referenced = new Set<string>();
    for (const s of stories) if (s.imageUrl) referenced.add(s.imageUrl);
    for (const p of postImgs) referenced.add(p.url);
    for (const i2 of otherItems) referenced.add(i2.imageUrl);
    for (const c of otherCovers) if (c.coverUrl) referenced.add(c.coverUrl);

    await destroyAssets(candidates.filter((u) => !referenced.has(u)));
  }

  revalidatePath("/profile/" + me);
  return { ok: true };
}

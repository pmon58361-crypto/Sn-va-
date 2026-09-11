"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Weekly goal targets, edited inline on the dashboard (kept here — next to
// its only UI — instead of the shared settings actions). Validated hard:
// small positive integers only, anything else is ignored.
export async function updateGoals(formData: FormData): Promise<void> {
  const session = await auth();
  const meId = session?.user?.id;
  if (!meId) return;

  const posts = Math.trunc(Number(formData.get("posts")));
  const replies = Math.trunc(Number(formData.get("replies")));
  const clean: { posts?: number; replies?: number } = {};
  if (Number.isFinite(posts) && posts >= 1 && posts <= 30) clean.posts = posts;
  if (Number.isFinite(replies) && replies >= 1 && replies <= 50) clean.replies = replies;
  if (Object.keys(clean).length === 0) return;

  const current = await prisma.settings.findUnique({
    where: { userId: meId },
    select: { goals: true },
  });
  const prev =
    current?.goals !== null && typeof current?.goals === "object" && !Array.isArray(current?.goals)
      ? (current.goals as Record<string, unknown>)
      : {};
  await prisma.settings.upsert({
    where: { userId: meId },
    create: { userId: meId, goals: { ...prev, ...clean } },
    update: { goals: { ...prev, ...clean } },
  });
  revalidatePath("/dashboard");
}

export async function resetGoalTargets(): Promise<void> {
  const session = await auth();
  const meId = session?.user?.id;
  if (!meId) return;
  await prisma.settings.upsert({
    where: { userId: meId },
    create: { userId: meId, goals: {} },
    update: { goals: {} },
  });
  revalidatePath("/dashboard");
}

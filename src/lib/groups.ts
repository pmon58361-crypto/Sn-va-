import { prisma } from "@/lib/prisma";

// URL-safe slug from a group name: "Design Crew!" -> "design-crew"
export function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "group"
  );
}

export async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 2;
  while (await prisma.group.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function getMembership(groupId: string, userId?: string | null) {
  if (!userId) return null;
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

/** Private groups render a locked card for non-members (admins see all). */
export function canViewGroup(
  group: { visibility: string },
  membership: { role: string } | null,
  isAdmin = false
): boolean {
  if (group.visibility === "public") return true;
  return !!membership || isAdmin;
}

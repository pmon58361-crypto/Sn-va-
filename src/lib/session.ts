import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Session helpers shared by every server action / admin surface.
 *
 * Three tiers, cheapest first:
 *  - requireUserId():    signed in? (JWT only, zero DB cost)
 *  - requireActiveUser(): signed in AND not banned (+ env-based admin
 *                         promotion). One PK lookup — used by write actions.
 *  - requireAdmin():     active AND role === "admin".
 *
 * JWT sessions can't be revoked server-side (known tradeoff), so the ban
 * check deliberately hits the database on every write instead of trusting
 * a stale token.
 */

export type ActiveUser = {
  id: string;
  email: string;
  role: string;
};

// ADMIN_EMAILS="you@x.com,other@y.com" — listed emails are promoted to
// admin automatically on their next authenticated action. Zero-setup
 // bootstrap for a solo operator.
function envAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

export async function requireActiveUser(): Promise<ActiveUser> {
  const id = await requireUserId();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, bannedAt: true },
  });
  if (!user) throw new Error("Unauthorized");

  if (user.bannedAt) {
    throw new Error("Your account has been suspended.");
  }

  // Promote from env list if needed (rare — fires once per promotion).
  if (
    user.role !== "admin" &&
    envAdminEmails().has(user.email.toLowerCase())
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
    });
    return { ...user, role: "admin" };
  }

  return { id: user.id, email: user.email, role: user.role };
}

export async function requireAdmin(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}

/** True when this viewer may see hidden posts (author or admin). */
export function canViewHidden(viewer: { id: string; role: string } | null, authorId: string): boolean {
  if (!viewer) return false;
  return viewer.id === authorId || viewer.role === "admin";
}

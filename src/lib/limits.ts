import { prisma } from "@/lib/prisma";

// ── New-account rate caps (anti-spam for the launch wave) ────────────────────
//
// Accounts younger than 24h get tighter daily caps on posts, comments and
// DMs. Zero cost: the counting queries only run for brand-new accounts, so
// established users pay nothing. Caps are env-tunable without redeploying
// schema or code structure.

const DAY_MS = 86_400_000;
const NEW_ACCOUNT_WINDOW_MS = 24 * 3_600_000;

export function isNewAccount(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() < NEW_ACCOUNT_WINDOW_MS;
}

export type LimitedKind = "post" | "comment" | "dm";

function capFor(kind: LimitedKind): number {
  switch (kind) {
    case "post":
      return Number(process.env.NEW_ACCOUNT_POST_CAP || 5);
    case "comment":
      return Number(process.env.NEW_ACCOUNT_COMMENT_CAP || 20);
    case "dm":
      return Number(process.env.NEW_ACCOUNT_DM_CAP || 20);
  }
}

/**
 * Returns true when a <24h-old account has already used up today's allowance
 * for `kind`. Established accounts skip the check entirely.
 */
export async function newAccountOverLimit(
  userId: string,
  createdAt: Date,
  kind: LimitedKind
): Promise<{ limited: boolean; cap: number }> {
  if (!isNewAccount(createdAt)) return { limited: false, cap: 0 };
  const cap = capFor(kind);
  const since = new Date(Date.now() - DAY_MS);

  let count = 0;
  if (kind === "post") {
    count = await prisma.post.count({
      where: { authorId: userId, createdAt: { gte: since } },
    });
  } else if (kind === "comment") {
    count = await prisma.comment.count({
      where: { authorId: userId, createdAt: { gte: since } },
    });
  } else {
    count = await prisma.message.count({
      where: { senderId: userId, createdAt: { gte: since } },
    });
  }
  return { limited: count >= cap, cap };
}

/** Friendly, copy-ready denial message. */
export function newAccountLimitMessage(kind: LimitedKind, cap: number): string {
  const noun = kind === "post" ? "posts" : kind === "comment" ? "comments" : "messages";
  return `New accounts can send up to ${cap} ${noun} per day. This limit lifts 24 hours after joining — welcome aboard!`;
}

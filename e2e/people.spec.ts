import { test, expect } from "@playwright/test";
import { demoUsers, prisma, signedInPage } from "./helpers";

test("people search filters results", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const previous = await prisma.settings.findUnique({ where: { userId: demo2.id } });
  await prisma.settings.upsert({ where: { userId: demo2.id }, update: { publicProfile: false }, create: { userId: demo2.id, publicProfile: false } });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/people?q=Demo%202");
    await expect(page.getByText("Nobody matches that search")).toBeVisible();
  } finally {
    await context.close();
    if (previous) await prisma.settings.update({ where: { id: previous.id }, data: { publicProfile: previous.publicProfile } });
    else await prisma.settings.deleteMany({ where: { userId: demo2.id } });
  }
});

// The admin private-profile override shipped in commit 04748a4 (train
// f0b1422). This test guards that override against regressions.
test("an admin can view a private profile", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const previous = await prisma.settings.findUnique({ where: { userId: demo2.id } });
  await prisma.settings.upsert({ where: { userId: demo2.id }, update: { publicProfile: false }, create: { userId: demo2.id, publicProfile: false } });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto(`/profile/${demo2.id}`);
    await expect(page.getByText("This profile is private.")).toHaveCount(0);
    // Name renders again after the 4556e25 identity-column fix.
    await expect(page.getByRole("heading", { name: demo2.name || "Demo 2" })).toBeVisible();
    // Stats render in both the mobile and desktop blocks; assert the visible one.
    await expect(page.getByText("follower").filter({ visible: true }).first()).toBeVisible();
  } finally {
    await context.close();
    if (previous) await prisma.settings.update({ where: { id: previous.id }, data: { publicProfile: previous.publicProfile } });
    else await prisma.settings.deleteMany({ where: { userId: demo2.id } });
  }
});

// Mirrors src/lib/founding.ts: under the limit everyone qualifies; above it,
// only accounts created no later than the 500th.
async function expectsFounding(userId: string): Promise<boolean> {
  const FOUNDING_LIMIT = 500;
  const total = await prisma.user.count();
  if (total <= FOUNDING_LIMIT) return true;
  const nth = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    skip: FOUNDING_LIMIT - 1,
    take: 1,
    select: { createdAt: true },
  });
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
  return me.createdAt <= (nth[0]?.createdAt ?? new Date(0));
}

// The badge shipped in bfc3f14 and went live locally with the EOD rebuild.
test("founding member badge follows account seniority", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const shouldShow = await expectsFounding(demo2.id);
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto(`/profile/${demo2.id}`);
    const badge = page.getByText("Founding Member");
    if (shouldShow) await expect(badge.first()).toBeVisible();
    else await expect(badge).toHaveCount(0);
  } finally {
    await context.close();
  }
});

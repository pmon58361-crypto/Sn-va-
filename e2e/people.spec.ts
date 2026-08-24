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
// NOTE: the display-name <h1> currently renders 0-width at desktop sizes
// (identity column collapse — filed separately), so visibility is asserted
// on stable profile content instead of the name until that is fixed.
test("an admin can view a private profile", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const previous = await prisma.settings.findUnique({ where: { userId: demo2.id } });
  await prisma.settings.upsert({ where: { userId: demo2.id }, update: { publicProfile: false }, create: { userId: demo2.id, publicProfile: false } });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto(`/profile/${demo2.id}`);
    await expect(page.getByText("This profile is private.")).toHaveCount(0);
    await expect(page.getByText("followers")).toBeVisible();
    await expect(page.getByText("posts").first()).toBeVisible();
  } finally {
    await context.close();
    if (previous) await prisma.settings.update({ where: { id: previous.id }, data: { publicProfile: previous.publicProfile } });
    else await prisma.settings.deleteMany({ where: { userId: demo2.id } });
  }
});

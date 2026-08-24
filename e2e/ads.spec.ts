import { test, expect } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

test("an admin can create, serve, pause, and delete a feed ad", async ({ browser }) => {
  const { demo } = await demoUsers();
  const headline = `${E2E_PREFIX} sponsored headline`;
  const advertiser = `${E2E_PREFIX} advertiser`;
  // Feed ads intentionally appear only with a substantial feed. These are test fixtures,
  // not an assertion shortcut: creation and lifecycle continue through the admin UI.
  await prisma.post.createMany({
    data: Array.from({ length: 10 }, (_, index) => ({
      authorId: demo.id,
      category: "COMMUNITY",
      title: `${E2E_PREFIX} feed fixture ${index}`,
      content: `${E2E_PREFIX} feed fixture body ${index}`,
    })),
  });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/admin/ads");
    await expect(page.getByRole("heading", { name: "Ads", exact: true })).toBeVisible();
    const create = page.locator("section").filter({ has: page.getByRole("heading", { name: "Create ad" }) });
    await create.locator("input").nth(0).fill(advertiser);
    await create.locator("input").nth(1).fill(headline);
    await create.locator("input").nth(2).fill("https://example.com/e2e");
    await create.getByRole("button", { name: "Create ad" }).click();
    const card = page.locator("article").filter({ hasText: headline });
    await expect(card).toBeVisible();

    await page.goto("/community");
    await expect(page.getByText(headline)).toBeVisible();
    // exact:true — the headline text itself contains the word "sponsored",
    // so a substring match would collide with the ad card body.
    await expect(page.getByText("Sponsored", { exact: true })).toBeVisible();
    const ad = await prisma.ad.findFirstOrThrow({ where: { advertiser, headline } });
    expect(ad.impressions).toBeGreaterThanOrEqual(1);

    await page.goto("/admin/ads");
    const activeCard = page.locator("article").filter({ hasText: headline });
    await activeCard.getByRole("button", { name: "Pause" }).click();
    await expect(activeCard.getByText("Paused")).toBeVisible();
    await page.goto("/community");
    await expect(page.getByText(headline)).toHaveCount(0);

    await page.goto("/admin/ads");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("article").filter({ hasText: headline }).getByRole("button", { name: "Delete ad" }).click();
    await expect(page.getByText(headline)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

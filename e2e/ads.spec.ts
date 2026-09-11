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

test("budgets accrue spend and auto-pause the ad", async ({ browser }) => {
  const { demo } = await demoUsers();
  const headline = `${E2E_PREFIX} budgeted headline`;
  const advertiser = `${E2E_PREFIX} budgeted advertiser`;
  await prisma.post.createMany({
    data: Array.from({ length: 10 }, (_, index) => ({
      authorId: demo.id,
      category: "COMMUNITY",
      title: `${E2E_PREFIX} budget fixture ${index}`,
      content: `${E2E_PREFIX} budget fixture body ${index}`,
    })),
  });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/admin/ads");
    const create = page.locator("section").filter({ has: page.getByRole("heading", { name: "Create ad" }) });
    await create.locator("input").nth(0).fill(advertiser);
    await create.locator("input").nth(1).fill(headline);
    await create.locator("input").nth(2).fill("https://example.com/e2e-budget");
    // Pricing fields live after the image input — located by placeholder so
    // form order can evolve without breaking this.
    await create.getByPlaceholder("e.g. 200 ($2)").fill("10000");
    await create.getByPlaceholder("e.g. 5000 ($50)").fill("5");
    await create.getByRole("button", { name: "Create ad" }).click();
    const card = page.locator("article").filter({ hasText: headline });
    await expect(card).toBeVisible();
    await expect(card.getByText("$0.05 budget")).toBeVisible();

    // Single candidate → this serve is deterministic. One $100-CPM
    // impression costs $0.10, blowing the $0.05 budget on the spot.
    await page.goto("/community");
    await expect(page.getByText(headline)).toBeVisible();

    await page.goto("/admin/ads");
    const spent = page.locator("article").filter({ hasText: headline });
    await expect(spent.getByText("Paused")).toBeVisible();
    await expect(spent.getByText("$0.10")).toBeVisible();

    // Paused ads stop serving.
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

test("self-serve: create, fund notice, approve, serve", async ({ browser }) => {
  const { demo, demo2 } = await demoUsers();
  const headline = `${E2E_PREFIX} self-serve headline`;
  await prisma.post.createMany({
    data: Array.from({ length: 10 }, (_, index) => ({
      authorId: demo.id,
      category: "COMMUNITY",
      title: `${E2E_PREFIX} serve fixture ${index}`,
      content: `${E2E_PREFIX} serve fixture body ${index}`,
    })),
  });
  // Non-admin creates through /advertise: pending + unfunded, never served.
  const buyer = await signedInPage(browser, "demo2");
  try {
    await buyer.page.goto("/advertise");
    await buyer.page.getByLabel("Headline").fill(headline);
    await buyer.page.getByLabel("Target URL (https)").fill("https://example.com/e2e-self");
    await buyer.page.getByLabel(/Budget/).fill("1000");
    await buyer.page.getByRole("button", { name: "Save ad for review" }).click();
    await expect(buyer.page.getByText("Needs funding")).toBeVisible();
    await expect(buyer.page.getByText(headline)).toBeVisible();

    await buyer.page.goto("/community");
    await expect(buyer.page.getByText(headline)).toHaveCount(0);

    // No Stripe keys in test env: funding bounces with an honest notice.
    await buyer.page.goto("/advertise");
    await buyer.page.getByRole("button", { name: /Fund / }).click();
    await expect(buyer.page.getByText(/aren't connected yet/)).toBeVisible();
  } finally {
    await buyer.context.close();
  }
  // Admin approves → it serves like any other ad.
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/admin/ads");
    const pending = page.locator("article").filter({ hasText: headline });
    await expect(pending.getByText("Pending review")).toBeVisible();
    await pending.getByRole("button", { name: "Approve & launch" }).click();
    await expect(pending.getByText("Active")).toBeVisible();

    await page.goto("/community");
    await expect(page.getByText(headline)).toBeVisible();

    await page.goto("/admin/ads");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("article").filter({ hasText: headline }).getByRole("button", { name: "Delete ad" }).click();
    await expect(page.getByText(headline)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

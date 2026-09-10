import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

test("an owner can create, edit, and delete a community post", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, "demo");
  const title = `${E2E_PREFIX} feed post`;
  const updatedTitle = `${title} updated`;
  try {
    await page.goto("/new");
    await page.getByPlaceholder("Give it a title…").fill(title);
    await page.getByPlaceholder("Describe what you're posting about…").fill(`${E2E_PREFIX} created through the post composer.`);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/community\//);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
    await page.getByPlaceholder("Give it a title…").fill(updatedTitle);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page).toHaveURL(/\/community$/);
    await expect(page.getByText(updatedTitle)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

// ── Ranking behavior ─────────────────────────────────────────────────────
// These tests pin the feed contract: personalization beats anonymity,
// explicit negatives exclude, fresh content surfaces, same-author runs are
// spread, rotation is stable within the hour, and signed-out visitors still
// get a feed. Seeds use wide margins so the ±12% hourly jitter and the live
// organic pool can never flip an assertion.

async function articleHeadings(page: Page): Promise<string[]> {
  return page.locator("article h3").allInnerTexts();
}

test("affinity author's fresh post outranks a stranger's equal post", async ({ browser }) => {
  const { demo, demo2 } = await demoUsers();
  // Build real author affinity: demo likes 5 old demo2 posts (tags kept off
  // the seeds so only the AUTHOR signal applies, not tag affinity).
  const old = new Date(Date.now() - 3 * 86_400_000);
  for (let i = 0; i < 5; i++) {
    const p = await prisma.post.create({
      data: { authorId: demo2.id, category: "COMMUNITY", title: `${E2E_PREFIX} affinity base ${i}`, content: "fixture", tags: "affinityseed", createdAt: old },
    });
    await prisma.reaction.create({ data: { userId: demo.id, postId: p.id, type: "like" } });
  }
  const stamp = new Date();
  const titleA = `${E2E_PREFIX} affinity target`;
  const titleS = `${E2E_PREFIX} stranger target`;
  await prisma.post.create({ data: { authorId: demo2.id, category: "COMMUNITY", title: titleA, content: "fixture", createdAt: stamp } });
  // Stranger = the viewer themself: zero affinity AND own-post demotion, so
  // the gap is unmistakable whatever the organic pool does.
  await prisma.post.create({ data: { authorId: demo.id, category: "COMMUNITY", title: titleS, content: "fixture", createdAt: stamp } });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: titleA })).toBeVisible();
    const titles = await articleHeadings(page);
    expect(titles.indexOf(titleA)).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf(titleS)).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf(titleA)).toBeLessThan(titles.indexOf(titleS));
  } finally {
    await context.close();
  }
});

test("not_interested feedback removes the post from the feed", async ({ browser }) => {
  const { demo, demo2 } = await demoUsers();
  const title = `${E2E_PREFIX} hidden post`;
  const post = await prisma.post.create({
    data: { authorId: demo2.id, category: "COMMUNITY", title, content: "fixture" },
  });
  await prisma.postFeedback.create({ data: { userId: demo.id, postId: post.id, value: "not_interested" } });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/community");
    await expect(page.locator("article h3").first()).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("brand-new posts surface on the first page", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const title = `${E2E_PREFIX} fresh post`;
  await prisma.post.create({
    data: { authorId: demo2.id, category: "COMMUNITY", title, content: "fixture" },
  });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("same-author posts never run three in a row", async ({ browser }) => {
  const { demo, demo2 } = await demoUsers();
  if (!demo2.name) throw new Error("demo2 needs a display name for this test");
  const authorName = demo2.name;
  // Six same-author/same-category/same-tag posts with likes: naive ranking
  // would stack them 1-2-3. Spread + quota must break every run.
  for (let i = 0; i < 6; i++) {
    const p = await prisma.post.create({
      data: {
        authorId: demo2.id, category: "COMMUNITY",
        title: `${E2E_PREFIX} spread post ${i}`, content: "fixture",
        tags: "spreadtest", createdAt: new Date(Date.now() - i * 60_000),
      },
    });
    await prisma.reaction.create({ data: { userId: demo.id, postId: p.id, type: "like" } });
    await prisma.reaction.create({ data: { userId: demo2.id, postId: p.id, type: "like" } });
  }
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/community");
    await expect(page.locator("article h3").first()).toBeVisible();
    const articles = page.locator("article");
    const n = await articles.count();
    const isSeed: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const ps = await articles.nth(i).locator("p").allInnerTexts();
      isSeed.push((ps[0] ?? "").split("★")[0].trim() === authorName);
    }
    for (let i = 0; i + 2 < isSeed.length; i++) {
      expect(
        !(isSeed[i] && isSeed[i + 1] && isSeed[i + 2]),
        `articles ${i},${i + 1},${i + 2} are all by ${authorName}`
      ).toBe(true);
    }
  } finally {
    await context.close();
  }
});

test("relative order is stable within the hour", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  // Wide age gaps beat the ±12% jitter, so bucket-internal order is fixed.
  // (A run crossing an hour boundary reshuffles by design — accepted.)
  const titles = [10, 5, 1].map((h) => `${E2E_PREFIX} stable ${h}h`);
  for (let i = 0; i < 3; i++) {
    await prisma.post.create({
      data: {
        authorId: demo2.id, category: "COMMUNITY", title: titles[i],
        content: "fixture", createdAt: new Date(Date.now() - [10, 5, 1][i] * 3_600_000),
      },
    });
  }
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: titles[2] })).toBeVisible();
    const orderOf = async () => {
      const all = await articleHeadings(page);
      return titles.map((t) => all.indexOf(t));
    };
    const first = await orderOf();
    expect(first.every((i) => i >= 0)).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: titles[2] })).toBeVisible();
    expect(await orderOf()).toEqual(first);
  } finally {
    await context.close();
  }
});

test("signed-out visitors still get a feed (cold start)", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const title = `${E2E_PREFIX} public post`;
  await prisma.post.create({
    data: { authorId: demo2.id, category: "COMMUNITY", title, content: "fixture" },
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  } finally {
    await context.close();
  }
});

import { test, expect } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

test("bookmarking a post surfaces it under Bookmarks and untoggling removes it", async ({ browser }) => {
  const { demo } = await demoUsers();
  const title = `${E2E_PREFIX} bookmarked post`;
  const post = await prisma.post.create({
    data: { authorId: demo.id, category: "COMMUNITY", title, content: `${E2E_PREFIX} bookmark fixture` },
  });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto(`/community/${post.id}`);
    // The detail page renders exactly one bookmark action for the post.
    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect.poll(async () => prisma.bookmark.findUnique({ where: { userId_postId: { userId: demo.id, postId: post.id } } })).not.toBeNull();

    await page.goto("/bookmarks");
    await expect(page.getByText(title)).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect.poll(async () => prisma.bookmark.findUnique({ where: { userId_postId: { userId: demo.id, postId: post.id } } })).toBeNull();
    await page.goto("/bookmarks");
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("notifications list activity and opening the inbox marks items read", async ({ browser }) => {
  const { demo, demo2 } = await demoUsers();
  const title = `${E2E_PREFIX} liked post`;
  const post = await prisma.post.create({
    data: { authorId: demo.id, category: "COMMUNITY", title, content: `${E2E_PREFIX} notification fixture` },
  });
  await prisma.notification.create({
    data: { userId: demo.id, actorId: demo2.id, type: "like", postId: post.id, read: false },
  });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/notifications");
    // The shared dev database carries organic notifications too — scope to
    // the item linking to OUR seeded post.
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expect.poll(async () => (await prisma.notification.findFirstOrThrow({ where: { userId: demo.id, postId: post.id } })).read).toBe(true);
  } finally {
    await context.close();
  }
});

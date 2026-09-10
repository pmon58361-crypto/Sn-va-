import { test, expect } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

// A note with a real song title shows the title on its chip instead of the
// URL-derived provider label.
test("story music chip shows the song title", async ({ browser }) => {
  const { demo } = await demoUsers();
  const title = `${E2E_PREFIX} Test Song`;
  const story = await prisma.story.create({
    data: {
      authorId: demo.id,
      caption: `${E2E_PREFIX} note with music`,
      bg: "#1d9bf0",
      musicUrl: "https://open.spotify.com/track/e2e123",
      musicTitle: title,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  const { page, context } = await signedInPage(browser, "demo");
  try {
    await page.goto("/community");
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await prisma.story.delete({ where: { id: story.id } }).catch(() => null);
    await context.close();
  }
});

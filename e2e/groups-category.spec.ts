import { test, expect } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

// Directory category tabs: only live categories render; picking one filters
// the grid (this tree uses lowercase values + ?category=, rendered capitalized).
test("groups directory renders category tabs and filters", async ({ browser }) => {
  const { demo } = await demoUsers();
  const stamp = `${E2E_PREFIX} cat ${Date.now()}`;
  const craftName = `${stamp} craft room`;
  const cityName = `${stamp} city room`;
  const mk = (name: string, slug: string, category: string) =>
    prisma.group.create({
      data: { name, slug, category, creatorId: demo.id },
    });
  const craft = await mk(craftName, `e2e-cat-craft-${Date.now()}`, "craft");
  const city = await mk(cityName, `e2e-cat-city-${Date.now()}`, "city");
  const { page, context } = await signedInPage(browser, "demo");
  try {
    await page.goto("/groups");
    await expect(page.getByRole("link", { name: "All", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    // Values are lowercase in the DOM (CSS capitalizes the display), so
    // match exact-lowercase: card links carry longer names and won't match.
    await expect(page.getByRole("link", { name: "craft", exact: true })).toBeVisible();
    await expect(page.getByText(craftName).first()).toBeVisible();
    await expect(page.getByText(cityName).first()).toBeVisible();

    await page.getByRole("link", { name: "craft", exact: true }).click();
    await expect(page).toHaveURL(/category=craft/, { timeout: 15_000 });
    await expect(page.getByText(craftName).first()).toBeVisible();
    await expect(page.getByText(cityName)).toHaveCount(0);
  } finally {
    await context.close();
    await prisma.group.deleteMany({ where: { id: { in: [craft.id, city.id] } } }).catch(() => null);
  }
});

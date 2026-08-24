import { test, expect } from "@playwright/test";
import { E2E_PREFIX, signedInPage, cleanupE2EData } from "./helpers";

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

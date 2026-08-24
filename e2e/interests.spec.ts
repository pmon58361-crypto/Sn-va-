import { test, expect } from "@playwright/test";
import { demoUsers, prisma, signedInPage } from "./helpers";

test("picker can be skipped permanently and Settings shows its saved state", async ({ browser }) => {
  const { demo2 } = await demoUsers();
  const previous = await prisma.settings.findUnique({ where: { userId: demo2.id } });
  await prisma.settings.upsert({ where: { userId: demo2.id }, update: { interests: null }, create: { userId: demo2.id, interests: null } });
  const { context, page } = await signedInPage(browser, "demo2");
  try {
    await page.goto("/community");
    const dialog = page.getByRole("dialog", { name: "Pick your interests" });
    await expect(dialog).toBeVisible();
    const firstChip = dialog.getByRole("group", { name: "Topic suggestions" }).getByRole("button").first();
    await firstChip.click();
    await expect(firstChip).toHaveAttribute("aria-pressed", "true");
    await firstChip.click();
    await expect(firstChip).toHaveAttribute("aria-pressed", "false");
    await dialog.getByRole("button", { name: "Skip for now" }).click();
    await expect(dialog).toHaveCount(0);
    // The page may still be streaming its revalidated feed. The stored empty
    // value is the server-side “answered/skip” contract that prevents a return.
    await expect.poll(async () => (await prisma.settings.findUniqueOrThrow({ where: { userId: demo2.id } })).interests).toBe("");
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Interests" }).click();
    await expect(page.getByRole("tabpanel", { name: "Interests" })).toBeVisible();
    await expect(page.getByText("No interests yet — your feed runs on what you react to.")).toBeVisible();
  } finally {
    await context.close();
    if (previous) await prisma.settings.update({ where: { id: previous.id }, data: { interests: previous.interests } });
    else await prisma.settings.deleteMany({ where: { userId: demo2.id } });
  }
});

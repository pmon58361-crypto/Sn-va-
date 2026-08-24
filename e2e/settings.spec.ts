import { test, expect } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, createThrowawayAccount, prisma, signInWithPassword } from "./helpers";

test.afterEach(async () => cleanupE2EData());

test("interests editor saves custom topics", async ({ browser }) => {
  const throwaway = await createThrowawayAccount();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signInWithPassword(page, throwaway.email, throwaway.password);
    await page.getByRole("tab", { name: "Interests" }).click();
    const editor = page.getByRole("tabpanel", { name: "Interests" });
    await editor.getByLabel("Add a topic").fill(`${E2E_PREFIX} topic`);
    await editor.getByRole("button", { name: "Add" }).click();
    await editor.getByRole("button", { name: "Save interests" }).click();
    await expect(editor.getByText("Saved")).toBeVisible();
    await expect.poll(async () => (await prisma.settings.findUniqueOrThrow({ where: { userId: throwaway.user.id } })).interests).toContain("e2e");
  } finally {
    await context.close();
  }
});

// The reactivation paths now invalidate the session cache (C's 8159297,
// train f0b1422). This test guards the deactivation → sign-back-in
// round-trip against regressions.
test("deactivation is reversed on the next credentials sign-in", async ({ browser }) => {
  const throwaway = await createThrowawayAccount();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signInWithPassword(page, throwaway.email, throwaway.password);
    await page.getByRole("tab", { name: "Account" }).click();
    await page.getByRole("button", { name: "Deactivate account…" }).click();
    await page.getByRole("button", { name: "Yes, hide my account" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: throwaway.user.id } })).deactivatedAt).not.toBeNull();

    await signInWithPassword(page, throwaway.email, throwaway.password);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: throwaway.user.id } })).deactivatedAt).toBeNull();
  } finally {
    await context.close();
  }
});

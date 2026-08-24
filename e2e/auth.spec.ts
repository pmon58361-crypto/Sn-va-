import { test, expect } from "@playwright/test";
import { accessCodeFor, signInWithAccessCode } from "./helpers";

test("both demo access-code accounts can sign in", async ({ browser }) => {
  for (const account of ["demo", "demo2"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInWithAccessCode(page, account);
    await expect(page.getByRole("link", { name: /Community/i }).first()).toBeVisible();
    await context.close();
  }
});

test("a bad access code is rejected", async ({ page }) => {
  await page.goto("/auth/signin");
  const invalid = `${accessCodeFor("demo")}-invalid`;
  await page.getByPlaceholder("access code").fill(invalid);
  await page.getByRole("button", { name: /Enter with access code/ }).click();
  await expect(page).toHaveURL(/error=CredentialsSignin/);
});

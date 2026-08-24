import { test, expect, type Page } from "@playwright/test";

const DISMISS_KEY = "xpwa-dismiss";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Synthesize the Chromium install event the component listens for. */
async function dispatchInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as InstallEvent;
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });
}

test("install prompt appears only on the browser install event and stays dismissed", async ({ page }) => {
  // Regular visits must not push an install banner (no dark patterns).
  await page.goto("/community");
  // Give hydration time to attach the component's event listeners before
  // the first synthetic dispatch — early dispatches are simply missed.
  await page.waitForTimeout(1500);
  await expect(page.getByText("Install Snívať")).toHaveCount(0);

  // Chromium fires beforeinstallprompt when install criteria are met;
  // synthesize the same event to exercise the real listener path. The
  // listener attaches after hydration, so retry the dispatch until the
  // component answers.
  await expect(async () => {
    await dispatchInstallPrompt(page);
    await expect(page.getByText("Install Snívať")).toBeVisible();
  }).toPass({ timeout: 20_000 });

  // Dismissing persists across reloads.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Install Snívať")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), DISMISS_KEY)).toBe("1");

  // After a reload the flag (not the event) keeps the banner hidden.
  await page.reload();
  await expect(page.getByText("Install Snívať")).toHaveCount(0);
  await page.evaluate((key) => localStorage.removeItem(key), DISMISS_KEY);
  // The mount-time gate re-evaluates on the next full load.
  await page.reload();

  // A fresh profile would see the prompt again on the next install event.
  await expect(async () => {
    await dispatchInstallPrompt(page);
    await expect(page.getByText("Install Snívať")).toBeVisible();
  }).toPass({ timeout: 20_000 });
});

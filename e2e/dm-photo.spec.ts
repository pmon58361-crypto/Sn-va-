import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { E2E_PREFIX, cleanupE2EData, demoUsers, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

/** Same hidden-toolbar workaround as dm.spec.ts: dispatch a real click. */
async function clickNewestAction(page: Page, selector: string, labelMatch: string) {
  await page.evaluate(
    ({ sel, match }) => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(
        (el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").includes(match)
      );
      const el = els[els.length - 1];
      if (!el) throw new Error(`no element for ${sel} matching ${match}`);
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
    },
    { sel: selector, match: labelMatch }
  );
}

test("DM photo attachments: attach, send with caption, render, unsend", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const { demo2 } = await demoUsers();
  const caption = `${E2E_PREFIX} photo caption`;
  const sender = await signedInPage(browser, "demo");
  try {
    await sender.page.goto(`/dm/${demo2.id}`);

    // Stage a photo through the composer file input (local /uploads fallback).
    await sender.page
      .locator('input[type="file"]')
      .setInputFiles(path.join(process.cwd(), "public", "clock.jpg"));
    await expect(
      sender.page.getByRole("button", { name: "Remove attachment" })
    ).toBeVisible({ timeout: 30_000 });

    // Caption goes in the same composer box; arrow button sends.
    await sender.page.locator('[data-testid="dm-composer"]').fill(caption);
    await sender.page.locator('[data-testid="dm-send"]').click();

    // Renders in the thread: attached image (local /uploads URL) + caption.
    const img = sender.page.locator('main img[src*="/uploads/"]').last();
    await expect(img).toBeVisible({ timeout: 30_000 });
    await expect(sender.page.getByText(caption)).toBeVisible();

    // Unsend removes photo and caption for everyone.
    await expect(async () => {
      await clickNewestAction(sender.page, "button[aria-label]", "Message options");
      await clickNewestAction(sender.page, '[role="menuitem"]', "Unsend");
    }).toPass({ timeout: 45_000 });
    await expect(sender.page.getByText(caption)).toHaveCount(0);
    await expect(sender.page.locator('main img[src*="/uploads/"]')).toHaveCount(0);
  } finally {
    await sender.context.close();
  }
});

import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

/**
 * Every message row keeps its action bar mounted (hidden until hover), and
 * the absolutely-positioned bars overlap neighbouring rows, so pointer
 * hit-testing is unreliable here ("subtree intercepts pointer events"
 * retries forever). Resolve the newest matching button and send a real
 * bubbling click event — the React handlers run exactly as for a user.
 */
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

/** Live delivery to an open conversation is eventually-consistent; reload like a user would. */
async function expectWithReload(page: Page, text: string) {
  await expect(async () => {
    if ((await page.getByText(text).count()) === 0) await page.reload();
    await expect(page.getByText(text).first()).toBeVisible();
  }).toPass({ timeout: 30_000 });
}

test("DMs send optimistically, show seen, toggle reactions, unsend, and render gap dividers", async ({ browser }) => {
  // Two browsers, several sequential waits: a single hosted-DB stall window
  // must not eat the whole budget.
  test.setTimeout(150_000);
  const { demo, demo2 } = await demoUsers();
  const text = `${E2E_PREFIX} DM`;
  // An older message makes the subsequent UI-created message cross the 30-minute divider threshold.
  await prisma.message.create({
    data: { senderId: demo2.id, recipientId: demo.id, content: `${E2E_PREFIX} earlier`, createdAt: new Date(Date.now() - 31 * 60_000) },
  });
  const sender = await signedInPage(browser, "demo");
  const recipient = await signedInPage(browser, "demo2");
  try {
    await sender.page.goto(`/dm/${demo2.id}`);
    await expect(sender.page.locator("p.my-2.text-center").first()).toBeVisible();
    await sender.page.getByPlaceholder("Start a new message").fill(text);
    await sender.page.getByRole("button", { name: "Send" }).click();
    await expect(sender.page.getByText(text)).toBeVisible();

    await recipient.page.goto(`/dm/${demo.id}`);
    await expectWithReload(recipient.page, text);
    await expect(async () => {
      if ((await sender.page.getByText("Seen").count()) === 0) await sender.page.reload();
      await expect(sender.page.getByText("Seen").first()).toBeVisible();
    }).toPass({ timeout: 30_000 });

    await expect(async () => {
      await clickNewestAction(recipient.page, "button[aria-label]", "React ❤️");
    }).toPass({ timeout: 30_000 });
    await expect(recipient.page.getByRole("button", { name: "❤️ 1" })).toBeVisible();

    await expect(async () => {
      await clickNewestAction(recipient.page, "button[aria-label]", "❤️ 1");
    }).toPass({ timeout: 30_000 });
    await expect(recipient.page.getByRole("button", { name: "❤️ 1" })).toHaveCount(0);

    await expect(async () => {
      await clickNewestAction(sender.page, "button[aria-label]", "Message options");
      await clickNewestAction(sender.page, '[role="menuitem"]', "Unsend");
    }).toPass({ timeout: 45_000 });
    await expect(sender.page.getByText(text)).toHaveCount(0);
    await recipient.page.reload();
    await expect(recipient.page.getByText(text)).toHaveCount(0);
  } finally {
    await sender.context.close();
    await recipient.context.close();
  }
});

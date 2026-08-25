import { test, expect, type Page } from "@playwright/test";
import {
  E2E_PREFIX,
  cleanupE2EData,
  demoUsers,
  prisma,
  signedInPage,
} from "./helpers";

// Verification walk for the sprint lane: polls, music notes, Discord-style
// DM toolbar, sidebar install button. Runs against any local server via
// E2E_BASE_URL. Cleans its own fixtures.

const NOTE_TAG = `${E2E_PREFIX} note`;

test.afterEach(async () => {
  await cleanupE2EData();
  await prisma.story
    .deleteMany({ where: { caption: { startsWith: NOTE_TAG } } })
    .catch(() => {});
});

test.describe.configure({ mode: "serial" });

test("poll: author creates via composer, peer votes, real results render", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const title = `${E2E_PREFIX} poll`;
  const author = await signedInPage(browser, "demo");
  const voter = await signedInPage(browser, "demo2");
  try {
    // Create through the real composer UI.
    await author.page.goto("/new");
    await author.page.getByPlaceholder(/Give it a title/i).first().fill(title);
    await author.page
      .getByPlaceholder(/Describe what you're posting/i).first()
      .fill("Poll body text for e2e verification.");
    await author.page.getByRole("button", { name: /Add a poll/ }).click();
    await author.page.getByPlaceholder("Poll question").fill("Best sprint snack?");
    await author.page.getByPlaceholder("Option 1").fill("Coffee");
    await author.page.getByPlaceholder("Option 2").fill("Tea");
    await author.page.getByRole("button", { name: "Publish" }).click();
    await expect(author.page).toHaveURL(/\/community\//, { timeout: 30_000 });

    // Author sees results view immediately (totals without voting).
    await expect(author.page.getByText("Best sprint snack?")).toBeVisible();
    await expect(author.page.getByText(/0 votes/).first()).toBeVisible();

    // Feed card renders the poll; peer votes once.
    await voter.page.goto("/community");
    await expect(voter.page.getByText(title)).toBeVisible();
    await voter.page.getByRole("button", { name: "Coffee" }).first().click();
    await expect(voter.page.getByText("1 vote").first()).toBeVisible();
    await expect(voter.page.getByText(/100%/).first()).toBeVisible();
  } finally {
    await author.context.close();
    await voter.context.close();
  }
});

test("music note: link field persists and chip renders on the bubble", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = (await signedInPage(browser, "demo")).page;
  try {
    await page.goto("/community");
    await page.getByRole("button", { name: /Add a note/i }).click();
    await page.getByPlaceholder("Share a quick thoughtâ€¦").fill(`${NOTE_TAG} ðŸŽ§`);
    await page
      .getByPlaceholder(/Add a Spotify/)
      .fill("https://open.spotify.com/track/e2e-verify");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText(`${NOTE_TAG} ðŸŽ§`).first()).toBeVisible({ timeout: 30_000 });
    // Chip deep-links out with the provider label.
    const chip = page.locator('a[aria-label="Listen on Spotify"]').first();
    await expect(chip).toBeVisible();
    expect(await chip.getAttribute("href")).toContain("spotify.com");
    expect(await chip.getAttribute("rel")).toContain("noopener");
  } finally {
    await page.context().close();
  }
});

test("DM toolbar: hover pill has react/copy/more; smiley opens emoji popup that reacts", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const { demo2 } = await demoUsers();
  const text = `${E2E_PREFIX} toolbar`;
  const sender = await signedInPage(browser, "demo");
  try {
    await sender.page.goto(`/dm/${demo2.id}`);
    await sender.page.getByPlaceholder("Start a new message").fill(text);
    await sender.page.getByRole("button", { name: "Send" }).click();
    await expect(sender.page.getByText(text)).toBeVisible();

    // The old always-visible emoji row is GONE: no React-label buttons until
    // the popup opens.
    await expect(
      sender.page.getByLabel(/^React /).filter({ visible: true })
    ).toHaveCount(0);

    // Hover pill: three icon buttons on the newest bubble's bar.
    const react = sender.page.getByLabel("Add reaction").last();
    const copy = sender.page.getByLabel("Copy message").last();
    const more = sender.page.getByLabel("Message options").last();
    for (const btn of [react, copy, more]) {
      await expect(btn).toBeAttached();
    }

    // Smiley click opens the popup; tapping an emoji creates a reaction pill.
    await react.dispatchEvent("click");
    await sender.page.getByLabel("React â¤ï¸").last().dispatchEvent("click");
    await expect(sender.page.getByText("â¤ï¸").first()).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await sender.context.close();
  }
});

test("install button: hidden on desktop without prompt availability, iOS shows hint popover", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  // Desktop chromium headless never fires beforeinstallprompt â†’ honest hide.
  const desktop = await signedInPage(browser, "demo");
  try {
    await desktop.page.goto("/community");
    await expect(desktop.page.getByRole("button", { name: "Install app" })).toHaveCount(0);

    // iPhone UA â†’ iOS branch â†’ button visible, popover explains the flow.
    // iPhone UA at DESKTOP viewport (the sidebar is lg-only): exercises the
    // component's iOS branch. NOTE: on real phones the sidebar doesn't render
    // at all â€” mobile reachability is a separate design question.
    const ctx = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 1280, height: 800 },
    });
    const ios = await ctx.newPage();
    await ios.goto("/auth/signin");
    // Sign in via access code on this fresh context.
    const { signInWithAccessCode } = await import("./helpers");
    await signInWithAccessCode(ios, "demo");
    await expect(
      ios.getByRole("button", { name: "Install app" })
    ).toBeVisible({ timeout: 30_000 });
    await ios.getByRole("button", { name: "Install app" }).click();
    await expect(ios.getByText("Add to Home Screen", { exact: false }).first()).toBeVisible();
    await ctx.close();
  } finally {
    await desktop.context.close();
  }
});

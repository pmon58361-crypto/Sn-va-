import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  E2E_PREFIX,
  cleanupE2EData,
  demoUsers,
  prisma,
  signedInPage,
} from "./helpers";

test.afterEach(async () => cleanupE2EData());

// Push wiring: settings row renders, and the subscribe/unsubscribe API
// round-trips a device row. Live delivery needs a real browser grant + push
// service, which headless CI cannot do — the send path (lib/push.ts) is
// covered by tsc/build plus the API contract tested here.
test("push toggle renders and device subscribe/unsubscribe round-trips", async ({
  browser,
}) => {
  const { demo } = await demoUsers();
  const { page, context } = await signedInPage(browser, "demo");
  const endpoint = `https://fcm.googleapis.com/fcm/send/${E2E_PREFIX}-no2`;
  try {
    // Settings row renders with an honest state, whatever this browser does.
    // (This tree keeps notification prefs + push toggle under Privacy.)
    await page.goto("/settings");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const t = tabs.find(
        (el) =>
          el.textContent?.includes("Privacy") && el.closest("form")
      );
      if (!t) throw new Error("privacy tab not found");
      t.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
    });
    await expect(page.getByText("Push notifications")).toBeVisible({
      timeout: 15_000,
    });

    // Signed-out callers are refused (fresh context, no session).
    const ghost = await browser.newContext();
    try {
      const anon = await ghost.request.post(`${BASE_URL}/api/push/subscribe`, {
        data: { endpoint, keys: { p256dh: "x", auth: "y" } },
      });
      expect(anon.status()).toBe(401);
    } finally {
      await ghost.close();
    }

    // Malformed subscriptions are rejected, not stored.
    const bad = await page.request.post(`${BASE_URL}/api/push/subscribe`, {
      data: { endpoint: "not-a-url", keys: { p256dh: "x", auth: "y" } },
    });
    expect(bad.status()).toBe(400);

    // Well-formed subscription stores exactly one device row.
    const sub = await page.request.post(`${BASE_URL}/api/push/subscribe`, {
      data: { endpoint, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } },
    });
    expect(sub.ok()).toBe(true);
    await expect(
      prisma.pushSubscription.count({ where: { userId: demo.id, endpoint } })
    ).resolves.toBe(1);

    // Opt-out removes it.
    const unsub = await page.request.post(`${BASE_URL}/api/push/unsubscribe`, {
      data: { endpoint },
    });
    expect(unsub.ok()).toBe(true);
    await expect(
      prisma.pushSubscription.count({ where: { userId: demo.id, endpoint } })
    ).resolves.toBe(0);
  } finally {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    await context.close();
  }
});

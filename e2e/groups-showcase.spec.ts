import { test, expect } from "@playwright/test";
import { demoUsers, prisma, signedInPage } from "./helpers";

// NOTE: fixtures intentionally do NOT use the shared "E2E e2e-" prefix —
// other agents' suite-wide cleanups match that broad prefix and would wipe
// our rows mid-run (observed as phantom P2025s). Everything created here is
// deleted explicitly in the finally block below. No shared afterEach.
const TAG = `SHOWCASE-${Date.now()}`;

// Group showcase: rules save + display, pin → highlights row, invite copies.
test("group rules, pinned highlights and invite link", async ({ browser }) => {
  test.setTimeout(720_000);
  const { demo } = await demoUsers();
  const stamp = `${TAG} show`;
  const group = await prisma.group.create({
    data: {
      name: `${stamp}`,
      slug: `showcase-${Date.now()}`,
      joinMode: "open",
      visibility: "public",
      creatorId: demo.id,
      members: { create: { userId: demo.id, role: "owner" } },
    },
  });
  const post = await prisma.post.create({
    data: {
      authorId: demo.id,
      category: "COMMUNITY",
      title: `${stamp} pinned post`,
      content: `${stamp} highlight body`,
      groupId: group.id,
    },
  });
  const owner = await signedInPage(browser, "demo");
  try {
    await owner.page.goto(`/groups/${group.slug}`);

    // 1. Rules: empty state invites, save shows numbered list. Goal-first:
    // every click is guarded by the state that necessitates it, so the
    // block converges (and exits fast) from ANY intermediate UI state.
    await expect(async () => {
      if ((await owner.page.getByText("Be kind").count()) > 0) return;
      const editor = owner.page.getByLabel("Group rules");
      if ((await editor.count()) === 0) {
        await owner.page.getByRole("button", { name: "Add house rules" }).click();
      }
      await owner.page.getByLabel("Group rules").fill("Be kind\nNo spam");
      await owner.page.getByRole("button", { name: "Save rules" }).click();
      await expect(owner.page.getByText("Be kind")).toBeVisible({ timeout: 60_000 });
    }).toPass({ timeout: 200_000 });
    await expect(owner.page.getByText("No spam")).toBeVisible();

    // 2. Pin the post → highlights row shows it (click guarded: after a
    // successful pin the button flips to Unpin and a re-click would throw).
    const card = owner.page.locator("article", { hasText: `${stamp} pinned post` }).first();
    await expect(async () => {
      if ((await owner.page.getByText("📌 Highlights").count()) > 0) return;
      const pin = card.getByRole("button", { name: "Pin to highlights" });
      if ((await pin.count()) > 0) await pin.click();
      await expect(owner.page.getByText("📌 Highlights")).toBeVisible({ timeout: 60_000 });
    }).toPass({ timeout: 200_000 });
    const hl = owner.page.locator('section[aria-label="Pinned highlights"]');
    await expect(hl.getByText(`${stamp} pinned post`)).toBeVisible();

    // 3. Invite button copies the group URL (retried: the copied flash
    // only shows for ~1.5s and slow renders can miss it).
    await owner.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await expect(async () => {
      await owner.page.getByRole("button", { name: "Invite" }).click();
      await expect(owner.page.getByRole("button", { name: "Link copied" })).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 90_000 });
    expect(await owner.page.evaluate(() => navigator.clipboard.readText())).toContain(
      `/groups/${group.slug}`
    );

    // 4. Unpin removes it from highlights (goal-first: exit fast when
    // already gone, so a lagging UI can never trap the retry loop).
    await expect(async () => {
      if ((await owner.page.getByText("📌 Highlights").count()) === 0) return;
      const unpin = card.getByRole("button", { name: "Unpin from highlights" });
      if ((await unpin.count()) > 0) await unpin.click();
      await expect(owner.page.getByText("📌 Highlights")).toHaveCount(0, { timeout: 60_000 });
    }).toPass({ timeout: 200_000 });
  } finally {
    await owner.context.close();
    await prisma.post.delete({ where: { id: post.id } }).catch(() => null);
    await prisma.group.delete({ where: { id: group.id } }).catch(() => null);
  }
});

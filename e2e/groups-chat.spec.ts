import { test, expect } from "@playwright/test";
import {
  E2E_PREFIX,
  cleanupE2EData,
  createThrowawayAccount,
  demoUsers,
  prisma,
  signInWithPassword,
  signedInPage,
} from "./helpers";

test.afterEach(async () => cleanupE2EData());

// Group rooms: members send/read/share a room, outsiders get 404 + gate.
// Goal-first with patient inners (dm.spec convention) for hosted-DB stalls.
test("group members chat, outsiders are gated", async ({ browser }) => {
  test.setTimeout(600_000);
  const { demo, demo2 } = await demoUsers();
  const stamp = Date.now();
  const group = await prisma.group.create({
    data: {
      name: `${E2E_PREFIX} chat room`,
      slug: `e2e-chat-${stamp}`,
      joinMode: "open",
      visibility: "public",
      creatorId: demo.id,
      members: {
        create: [
          { userId: demo.id, role: "owner" },
          { userId: demo2.id, role: "member" },
        ],
      },
    },
  });
  const body = `${E2E_PREFIX} hello room ${stamp}`;
  const owner = await signedInPage(browser, "demo");
  const member = await signedInPage(browser, "demo2");
  try {
    // 1. Owner sends through the room composer.
    await owner.page.goto(`/groups/${group.slug}?view=chat`);
    await expect(owner.page.getByRole("link", { name: "# chat" })).toBeVisible();
    await owner.page.getByLabel("Message the room").fill(body);
    await owner.page.keyboard.press("Enter");
    await expect(owner.page.getByText(body)).toBeVisible({ timeout: 60_000 });

    // 2. Member sees it without reload tricks (poll catches up).
    await member.page.goto(`/groups/${group.slug}?view=chat`);
    await expect(member.page.getByText(body)).toBeVisible({ timeout: 60_000 });

    // 3. Outsider: API 404s, page shows the gate.
    const { user, email, password } = await createThrowawayAccount();
    void user;
    const outsiderCtx = await browser.newContext();
    const outsider = await outsiderCtx.newPage();
    try {
      await signInWithPassword(outsider, email, password);
      const api = await outsider.request.get(`/api/groups/${group.slug}/chat`);
      expect(api.status()).toBe(404);
      await outsider.goto(`/groups/${group.slug}?view=chat`);
      await expect(outsider.getByText("Members only")).toBeVisible();
    } finally {
      await outsiderCtx.close();
    }
  } finally {
    await owner.context.close();
    await member.context.close();
    await prisma.group.deleteMany({ where: { id: group.id } });
  }
});

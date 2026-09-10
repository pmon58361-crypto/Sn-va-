import { test, expect } from "@playwright/test";
import {
  E2E_PREFIX,
  cleanupE2EData,
  demoUsers,
  prisma,
  signedInPage,
} from "./helpers";

test.afterEach(async () => cleanupE2EData());

// Ops tail (the slow head — request/approve/promote — is covered by
// groups-ops.spec.ts): crown transfer → ex-owner leave → delete-keeps-posts.
test("group crown transfer, owner exit and delete-keeps-posts", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { demo, demo2 } = await demoUsers();
  const stamp = `${E2E_PREFIX} tail ${Date.now()}`;
  const group = await prisma.group.create({
    data: {
      name: `${stamp}`,
      slug: `e2e-ops-tail-${Date.now()}`,
      joinMode: "approval",
      visibility: "public",
      creatorId: demo.id,
      members: {
        create: [
          { userId: demo.id, role: "owner" },
          { userId: demo2.id, role: "moderator" },
        ],
      },
    },
  });
  const owner = await signedInPage(browser, "demo");
  const mod = await signedInPage(browser, "demo2");
  const post = await prisma.post.create({
    data: {
      authorId: demo2.id,
      category: "COMMUNITY",
      title: `${stamp} entry`,
      content: `${stamp} survives deletion`,
      groupId: group.id,
    },
  });
  const img = await prisma.postImage.create({
    data: { postId: post.id, url: "/uploads/e2e-keep.jpg", order: 0 },
  });
  try {
    // 1. Transfer the crown (roster ♛ → confirm).
    await owner.page.goto(`/groups/${group.slug}`);
    const roster = owner.page.locator("li", { hasText: demo2.name || "Someone" }).first();
    await expect(async () => {
      await roster.getByRole("button", { name: "Transfer ownership" }).click();
      await roster.getByRole("button", { name: "Confirm crown" }).click();
      await expect
        .poll(async () => (await prisma.group.findUnique({ where: { id: group.id } }))?.creatorId, { timeout: 20_000 })
        .toBe(demo2.id);
    }).toPass({ timeout: 120_000 });

    // 2. Previous owner (now a member) leaves normally.
    await owner.page.goto(`/groups/${group.slug}`);
    await expect(async () => {
      await owner.page.getByRole("button", { name: "Leave group" }).click();
      await expect
        .poll(async () => prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: demo.id } } }), { timeout: 20_000 })
        .toBeNull();
    }).toPass({ timeout: 120_000 });

    // 3. New owner deletes → group gone, post + image survive unscoped.
    await mod.page.goto(`/groups/${group.slug}`);
    await expect(async () => {
      await mod.page.getByRole("button", { name: "Delete group" }).click();
      await mod.page.getByRole("button", { name: "Yes, delete" }).click();
      await expect
        .poll(async () => prisma.group.findUnique({ where: { id: group.id } }), { timeout: 20_000 })
        .toBeNull();
    }).toPass({ timeout: 120_000 });
    const survived = await prisma.post.findUnique({
      where: { id: post.id },
      include: { images: true },
    });
    expect(survived?.groupId).toBeNull();
    expect(survived?.images.map((i) => i.url)).toContain("/uploads/e2e-keep.jpg");
  } finally {
    await mod.context.close();
    await owner.context.close();
    await prisma.postImage.delete({ where: { id: img.id } }).catch(() => null);
    await prisma.post.delete({ where: { id: post.id } }).catch(() => null);
    await prisma.groupJoinRequest.deleteMany({ where: { groupId: group.id } }).catch(() => null);
    await prisma.group.delete({ where: { id: group.id } }).catch(() => null);
  }
});

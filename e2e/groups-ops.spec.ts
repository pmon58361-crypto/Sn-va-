import { test, expect } from "@playwright/test";
import {
  E2E_PREFIX,
  cleanupE2EData,
  demoUsers,
  prisma,
  signedInPage,
} from "./helpers";

test.afterEach(async () => cleanupE2EData());

// Groups ops v2: tracked join requests (approval + private), moderator
// promotion, ownership transfer, owner exit, and delete-keeps-posts.
test("group join requests, moderation and ownership transfer", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  const { demo, demo2 } = await demoUsers();
  const stamp = `${E2E_PREFIX} ops ${Date.now()}`;
  const approval = await prisma.group.create({
    data: {
      name: `${stamp} approval`,
      slug: `e2e-ops-approval-${Date.now()}`,
      joinMode: "approval",
      visibility: "public",
      creatorId: demo.id,
      members: { create: { userId: demo.id, role: "owner" } },
    },
  });
  const priv = await prisma.group.create({
    data: {
      name: `${stamp} private`,
      slug: `e2e-ops-private-${Date.now()}`,
      joinMode: "open",
      visibility: "private",
      creatorId: demo.id,
      members: { create: { userId: demo.id, role: "owner" } },
    },
  });
  const owner = await signedInPage(browser, "demo");
  const applicant = await signedInPage(browser, "demo2");
  try {
    // 1. Request to join the approval group (with a hello message).
    // Goal-first: skip ahead when already sent; patient inners for 30s+
    // hosted-DB round-trips (dm.spec.ts convention, hardened).
    await applicant.page.goto(`/groups/${approval.slug}`);
    await expect(async () => {
      if ((await applicant.page.getByText("Request sent — the owner will review it.").count()) > 0) return;
      const send = applicant.page.getByRole("button", { name: "Send request" });
      if ((await send.count()) === 0) {
        await applicant.page.getByRole("button", { name: "Request to join" }).click();
        await applicant.page.getByLabel("Message to the owner").fill(`${E2E_PREFIX} hi`);
      }
      await applicant.page.getByRole("button", { name: "Send request" }).click();
      await expect(
        applicant.page.getByText("Request sent — the owner will review it.")
      ).toBeVisible({ timeout: 60_000 });
    }).toPass({ timeout: 200_000 });
    await expect
      .poll(async () =>
        prisma.groupJoinRequest.findUnique({
          where: { groupId_userId: { groupId: approval.id, userId: demo2.id } },
        })
      )
      .not.toBeNull();

    // 2. Private groups take requests too (join is impossible there).
    await applicant.page.goto(`/groups/${priv.slug}`);
    await expect(async () => {
      if ((await applicant.page.getByText("Request sent — the owner will review it.").count()) > 0) return;
      const send = applicant.page.getByRole("button", { name: "Send request" });
      if ((await send.count()) === 0) {
        await applicant.page.getByRole("button", { name: "Request to join" }).click();
      }
      await applicant.page.getByRole("button", { name: "Send request" }).click();
      await expect(
        applicant.page.getByText("Request sent — the owner will review it.")
      ).toBeVisible({ timeout: 60_000 });
    }).toPass({ timeout: 200_000 });

    // 3. Owner declines the private request; applicant stays an outsider.
    await owner.page.goto(`/groups/${priv.slug}`);
    await expect(owner.page.getByText("Join requests (1)")).toBeVisible({ timeout: 30_000 });
    const privReq = owner.page.locator('section[aria-label="Join requests"]', {
      hasText: demo2.name || "Someone",
    });
    await expect(async () => {
      await privReq.getByRole("button", { name: "Decline" }).click();
      await expect
        .poll(async () =>
          prisma.groupJoinRequest.findUnique({
            where: { groupId_userId: { groupId: priv.id, userId: demo2.id } },
          })
        , { timeout: 30_000 })
        .toBeNull();
    }).toPass({ timeout: 200_000 });

    // 4. Owner approves the approval-group request → membership.
    await owner.page.goto(`/groups/${approval.slug}`);
    await expect(owner.page.getByText("Join requests (1)")).toBeVisible({ timeout: 30_000 });
    const req = owner.page.locator('section[aria-label="Join requests"]', {
      hasText: demo2.name || "Someone",
    });
    await expect(async () => {
      await req.getByRole("button", { name: "Approve" }).click();
      await expect
        .poll(async () =>
          prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: approval.id, userId: demo2.id } },
          })
        , { timeout: 30_000 })
        .toMatchObject({ role: "member" });
    }).toPass({ timeout: 200_000 });

    // 5. Promote to moderator, then transfer the crown (each wrapped:
    // slow actions must not burn the whole budget on one shot).
    const roster = owner.page.locator("li", { hasText: demo2.name || "Someone" }).first();
    await expect(async () => {
      await roster.getByRole("button", { name: "Promote to moderator" }).click();
      await expect
        .poll(async () =>
          (
            await prisma.groupMember.findUnique({
              where: { groupId_userId: { groupId: approval.id, userId: demo2.id } },
            })
          )?.role
        , { timeout: 30_000 })
        .toBe("moderator");
    }).toPass({ timeout: 200_000 });
    await expect(async () => {
      await roster.getByRole("button", { name: "Transfer ownership" }).click();
      await roster.getByRole("button", { name: "Confirm crown" }).click();
      await expect
        .poll(async () =>
          (await prisma.group.findUnique({ where: { id: approval.id } }))?.creatorId
        , { timeout: 30_000 })
        .toBe(demo2.id);
    }).toPass({ timeout: 200_000 });

    // 6. Previous owner (now a member) leaves normally.
    await owner.page.goto(`/groups/${approval.slug}`);
    await expect(async () => {
      await owner.page.getByRole("button", { name: "Leave group" }).click();
      await expect
        .poll(async () =>
          prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: approval.id, userId: demo.id } },
          })
        , { timeout: 30_000 })
        .toBeNull();
    }).toPass({ timeout: 200_000 });

    // 7. Deleting a group keeps its posts (unscoped, images intact).
    const post = await prisma.post.create({
      data: {
        authorId: demo2.id,
        category: "COMMUNITY",
        title: `${stamp} entry`,
        content: `${stamp} survives deletion`,
        groupId: approval.id,
      },
    });
    const img = await prisma.postImage.create({
      data: { postId: post.id, url: "/uploads/e2e-keep.jpg", order: 0 },
    });
    await applicant.page.goto(`/groups/${approval.slug}`);
    await expect(async () => {
      await applicant.page.getByRole("button", { name: "Delete group" }).click();
      await applicant.page.getByRole("button", { name: "Yes, delete" }).click();
      await expect
        .poll(async () => prisma.group.findUnique({ where: { id: approval.id } }), { timeout: 30_000 })
        .toBeNull();
    }).toPass({ timeout: 200_000 });
    const survived = await prisma.post.findUnique({
      where: { id: post.id },
      include: { images: true },
    });
    expect(survived?.groupId).toBeNull();
    expect(survived?.images.map((i) => i.url)).toContain("/uploads/e2e-keep.jpg");
    await prisma.postImage.delete({ where: { id: img.id } }).catch(() => null);
    await prisma.post.delete({ where: { id: post.id } }).catch(() => null);
  } finally {
    await applicant.context.close();
    await owner.context.close();
    await prisma.groupJoinRequest
      .deleteMany({ where: { OR: [{ groupId: approval.id }, { groupId: priv.id }] } })
      .catch(() => null);
    await prisma.group.deleteMany({ where: { id: { in: [approval.id, priv.id] } } }).catch(() => null);
  }
});

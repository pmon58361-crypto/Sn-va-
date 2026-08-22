const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const t = async (name, fn) => {
    try { const r = await fn(); console.log("OK  ", name); }
    catch (e) { console.log("FAIL", name, "->", e.message.split("\n")[0]); }
  };
  await t("recentPosts", () => p.post.findMany({ take: 5, orderBy: { createdAt: "desc" }, where: { status: "open" }, include: { author: { select: { name: true, image: true } }, _count: { select: { reactions: true, comments: true } } } }));
  await t("tags", () => p.post.findMany({ take: 100, where: { tags: { not: null }, status: "open" }, select: { tags: true } }));
  await t("followingRows", () => p.follow.findMany({ where: { followerId: "x" }, select: { followingId: true } }));
  await t("whoToFollow", () => p.user.findMany({ where: { id: { notIn: ["x"] }, OR: [{ settings: { publicProfile: true } }, { settings: null }] }, orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }], take: 3, select: { id: true, name: true, image: true, bio: true, _count: { select: { followers: true, posts: true } } } }));
  await t("topVoices", () => p.user.findMany({ orderBy: [{ followers: { _count: "desc" } }], take: 5, select: { id: true, name: true, image: true, _count: { select: { followers: true, posts: true } } } }));
  await t("postsThisWeek", () => p.post.count({ where: { createdAt: { gte: weekAgo } } }));
  await t("openListings", () => p.post.count({ where: { category: "JOB_LISTING", status: "open" } }));
  await t("liveStories", () => p.story.count({ where: { expiresAt: { gt: new Date() } } }));
  await t("memberCount", () => p.user.count());
  const u = await p.user.count();
  console.log("users:", u);
  await p.$disconnect();
})().catch((e) => { console.error("FATAL:", e.message.split("\n")[0]); process.exit(1); });

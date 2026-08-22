const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.post
  .findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    where: { status: "open" },
    include: {
      author: { select: { name: true, image: true } },
      _count: { select: { reactions: true, comments: true } },
    },
  })
  .then((r) => {
    console.log("OK", r.length);
    return p.$disconnect();
  })
  .catch((e) => {
    console.log("CODE:", e.code);
    console.log("MSG:", e.message);
    console.log("STACK:", (e.stack || "").split("\n").slice(0, 5).join(" | "));
    process.exit(0);
  });

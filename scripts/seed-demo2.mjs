// Seeds the second demo account (idempotent — safe to run repeatedly).
// Usage:  node --env-file=.env scripts/seed-demo2.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO2_EMAIL = "demo2@snivat.local";
const DEMO2_PASSWORD = "demo1234";
const DEMO2_NAME = "Demo User 2";

async function main() {
  const hash = await bcrypt.hash(DEMO2_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO2_EMAIL },
    update: {},
    create: {
      email: DEMO2_EMAIL,
      name: DEMO2_NAME,
      provider: "credentials",
      bio: "Second demo account for testing DMs, follows, and interactions.",
    },
  });

  // Credentials-provider convention: bcrypt hash lives on Account.refresh_token.
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "credentials",
        providerAccountId: DEMO2_EMAIL,
      },
    },
    update: { refresh_token: hash },
    create: {
      userId: user.id,
      type: "credentials",
      provider: "credentials",
      providerAccountId: DEMO2_EMAIL,
      refresh_token: hash,
    },
  });

  console.log(`Seeded ${DEMO2_EMAIL} (password: ${DEMO2_PASSWORD}) -> user ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

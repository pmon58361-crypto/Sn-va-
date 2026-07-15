// Seed script: creates a demo user and a handful of sample posts across sections.
// Run with: `npm run db:seed`
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_EMAIL || "demo@snivat.local";
  const password = process.env.DEMO_PASSWORD || "demo1234";
  const hashed = await bcrypt.hash(password, 10);

  // Demo user
  const demo = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo User",
      bio: "I'm the built-in demo account. Try posting, commenting, and applying!",
      location: "Remote",
      provider: "credentials",
      role: "member",
      // store credentials-account fields in Account table
      accounts: {
        create: {
          type: "credentials",
          provider: "credentials",
          providerAccountId: email,
        },
      },
      settings: { create: {} },
    },
  });

  // A second sample user (so posts don't all belong to demo)
  const jane = await prisma.user.upsert({
    where: { email: "jane@snivat.local" },
    update: {},
    create: {
      email: "jane@snivat.local",
      name: "Jane Designer",
      bio: "Product designer, 6 years. Love working with early-stage startups.",
      location: "Lisbon, PT",
      provider: "credentials",
      role: "member",
      accounts: {
        create: {
          type: "credentials",
          provider: "credentials",
          providerAccountId: "jane@snivat.local",
        },
      },
      settings: { create: {} },
    },
  });

  // Community post
  await prisma.post.create({
    data: {
      category: "COMMUNITY",
      title: "Welcome to Snívať! Share your experiences here",
      content:
        "This is the community space. Tell us how your job hunt is going, share interview tips, or post about a project you're proud of. Be kind and helpful — we're all figuring this out together.",
      tags: "welcome,community",
      authorId: demo.id,
    },
  });

  await prisma.post.create({
    data: {
      category: "COMMUNITY",
      title: "How I landed my first freelance client",
      content:
        "After 3 months of nothing, I stopped cold-applying and started replying publicly to people who needed help on forums. Landed two clients in a week. Sharing in case it helps someone.",
      tags: "freelance,story",
      authorId: jane.id,
    },
  });

  // Job offer ("I do this work")
  await prisma.post.create({
    data: {
      category: "JOB_OFFER",
      title: "Full-stack developer available for freelance work",
      content:
        "I build web apps with React/Next.js and Node. Available 20h/week, comfortable taking a feature end-to-end. Open to equity-only arrangements for the right team.",
      tags: "react,nextjs,node,freelance",
      budget: "$50/hr",
      location: "Remote",
      type: "freelance",
      authorId: demo.id,
    },
  });

  // Job request ("I need someone")
  await prisma.post.create({
    data: {
      category: "JOB_REQUEST",
      title: "Looking for a brand designer for a SaaS launch",
      content:
        "We're launching a developer tool and need a logo + landing page visual direction. Budget is fixed, timeline is ~3 weeks. Please share a portfolio link.",
      tags: "design,branding",
      budget: "$2000 fixed",
      location: "Remote",
      type: "contract",
      authorId: jane.id,
    },
  });

  // Job listing (apply to)
  await prisma.post.create({
    data: {
      category: "JOB_LISTING",
      title: "Frontend Engineer (React) — Full-time, Remote",
      content:
        "We're a small team building tools for creators. We need a frontend engineer who cares about UX and writes clean TypeScript. You'll own the component library and work closely with design.",
      tags: "react,typescript,full-time",
      budget: "$90k–$120k",
      location: "Remote (US/EU timezones)",
      type: "full-time",
      authorId: jane.id,
    },
  });

  console.log("Seed complete. Users:", demo.email, jane.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

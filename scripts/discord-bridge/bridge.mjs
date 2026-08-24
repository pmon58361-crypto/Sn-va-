#!/usr/bin/env node
// ── Snívať → Discord bridge ──────────────────────────────────────────────────
// Posts the day's top community post into a Discord server via WEBHOOK
// (no bot account needed). Zero dependencies beyond the app's own prisma
// client — run from the repo root:  node scripts/discord-bridge/bridge.mjs
//
// Env required:
//   DISCORD_WEBHOOK_URL  — server webhook URL (create in Discord: Server
//                          Settings → Integrations → Webhooks → New)
//   DATABASE_URL         — same Neon database as the app
// Optional:
//   NEXT_PUBLIC_APP_URL  — link base (default https://snivat.vercel.app)
//   BRIDGE_WINDOW_HOURS  — look-back window (default 24)
//   BRIDGE_STATE_PATH    — dedupe state file location
//                          (default <os tmpdir>/snivat-bridge-state.json)
//
// Behavior guarantees:
//   - NEVER posts when there are no posts or no reactions in the window
//     (empty days stay silent — no spam).
//   - Dedupes: the same post is never sent twice while the state file
//     persists (best-effort on ephemeral CI filesystems — see README).

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const req = createRequire(path.join(process.cwd(), "package.json"));

function env(key, fallback) {
  const v = process.env[key] ?? fallback;
  if (!v) {
    console.error(`[discord-bridge] missing env ${key}`);
    process.exit(1);
  }
  return v;
}

const WEBHOOK = env("DISCORD_WEBHOOK_URL");
process.env.DATABASE_URL = env("DATABASE_URL");
const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://snivat.vercel.app").replace(/\/$/, "");
const WINDOW_HOURS = Number(process.env.BRIDGE_WINDOW_HOURS || 24);
const STATE_PATH =
  process.env.BRIDGE_STATE_PATH ||
  path.join(os.tmpdir(), "snivat-bridge-state.json");

const ACCENT = 0x2f9e6b;

async function main() {
  const { PrismaClient } = req("@prisma/client");
  const db = new PrismaClient();

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000);
  const top = await db.post.findFirst({
    where: {
      category: "COMMUNITY",
      hidden: false,
      createdAt: { gte: since },
    },
    orderBy: { reactions: { _count: "desc" } },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      author: { select: { name: true } },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  await db.$disconnect();

  if (!top) {
    console.log("[discord-bridge] no community posts in window — staying silent");
    return;
  }
  if (top._count.reactions === 0) {
    console.log(
      "[discord-bridge] top post has zero reactions — staying silent (never spam empties)"
    );
    return;
  }

  // Dedupe: never repost the same post id while state persists.
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {}
  if (state.lastPostId === top.id) {
    console.log("[discord-bridge] top post already announced — skipping");
    return;
  }

  const excerpt =
    top.content.length > 300
      ? top.content.slice(0, 300).trimEnd() + "…"
      : top.content;

  const payload = {
    username: "Snívať",
    embeds: [
      {
        title: top.title.slice(0, 250),
        url: `${SITE}/community/${top.id}`,
        description: excerpt,
        color: ACCENT,
        author: { name: top.author?.name || "Someone" },
        footer: {
          text: `Top post of the day · ${top._count.reactions} reaction${
            top._count.reactions === 1 ? "" : "s"
          } · ${top._count.comments} comment${top._count.comments === 1 ? "" : "s"}`,
        },
        timestamp: new Date(top.createdAt).toISOString(),
      },
    ],
  };

  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[discord-bridge] webhook POST failed: ${res.status} ${body.slice(0, 200)}`
    );
    process.exit(1);
  }

  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify({ lastPostId: top.id, at: new Date().toISOString() }, null, 2)
  );
  console.log(`[discord-bridge] announced "${top.title.slice(0, 60)}"`);
}

main().catch((e) => {
  console.error("[discord-bridge] failed:", e.message);
  process.exit(1);
});

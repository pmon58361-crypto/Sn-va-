# Snívať — Working Guidelines

How to build Snívať. For the product vision, brand, and audience, see `PRODUCT.md`.

---

## Tech Stack

- Next.js 15 with App Router
- React 18.3.1 (**NOT React 19** — do not use React 19-only APIs like `useActionState`)
- TypeScript
- Prisma with PostgreSQL (Neon serverless in prod, SQLite only for local fallback)
- NextAuth v5 (beta)
- Tailwind CSS
- Server Actions

---

## Engineering Principles

1. Functionality is always more important than appearance
2. Build production-quality code whenever reasonable
3. Make small, reversible improvements
4. Avoid unnecessary rewrites
5. Explain WHY a bug happened before fixing it
6. If the creator's idea is bad, say so directly with reasoning
7. Challenge decisions when there is a better engineering or product approach
8. No blind agreement — honest engineering feedback only

Every feature should be reversible. Keep architecture simple.

---

## Core Principles

- Community first
- No engagement bait
- No infinite scrolling tricks
- No dark patterns
- Fast first paint
- Mobile-first
- Accessibility matters

**Every feature must answer:** Why will users return?

---

## Architecture Decisions

| Decision | Reason | Tradeoff |
|---|---|---|
| React 18 only — no `useActionState` | React 19 not in stack; use `useState` + `onSubmit` | More boilerplate than the action API |
| Yahoo OAuth registered as `as never` cast | No Auth.js v5 provider; custom OAuth object | Type hack, works at runtime |
| V1 is permanent — no V2/rewrite | Restarting destroys momentum | Carries tech debt forward |
| JWT session strategy + Prisma adapter | Edge middleware can't use Prisma Client | Tokens not revocable server-side |
| `Post` reused across 4 categories | One model, one feed primitive for V1 | Job posts carry empty community fields |
| Password hash stored on `Account.refresh_token` | Cheap reuse, avoids schema churn | Misleading field name; document or migrate later |

When a decision here is superseded, replace the row — don't append a new dated entry.

---

## Testing Philosophy

Stop thinking like a developer. Think like a first-time user.

**Don't ask:** "Does this function return the correct value?"

**Ask:**
- Can a new user understand the website?
- Can they register?
- Can they create a profile?
- Can they make a post with photos?
- Can they apply for a job?
- Can they comment?
- Can they log out and back in?
- Would they enjoy using the product?

Test complete user journeys through the UI whenever possible.
Only use direct database manipulation for debugging.

---

## Design Principles

Snívať should never feel like an AI-generated template. It should feel like a real startup product.

**Focus on:** branding, typography, spacing, hierarchy, consistency, usability, accessibility, memorable first impressions.

**Avoid:** unnecessary animations, unnecessary visual effects, unnecessary emojis inside the product, generic AI-looking layouts.

**Gradients are reserved for the brand mark only. UI chrome stays flat.**

---

## Working Rules

- Question assumptions
- Challenge weak ideas
- Don't agree just to agree
- If a better engineering solution exists, say so and explain why
- Always optimize for the long-term health of the product

Remember: the goal isn't to build another social network. The goal is to build a place people genuinely want to return to.

---

## Current State (2026-09-13 — live on snivat.vercel.app)

- Project builds and compiles cleanly (`tsc` clean), dev server on `:3000` (No.2 owns rebuilds)
- Stack live in prod: Next.js 15 + React 18.3.1 + Prisma + PostgreSQL (Neon) + Auth.js v5 + Tailwind + Cloudinary
- Core shipped: community/jobs feeds (ranked + Following), stories, DMs, groups, profiles/highlights, bookmarks, reactions, comments, dashboard, moderation/bans, PWA (offline + push infra)
- Recent ships (since 2026-09-04): direct-to-Cloudinary signed uploads + client compression + ledger (`Upload` + Post.kind before_after + PostImage.alt), before/after drag slider + composer + profile badge, challenge entry chip on cards, referral attribution (`User.refSource` + first-touch cookie + `/admin/referrals` funnel), dynamic OG share cards (split RAW/FINAL, `revalidate:3600`) + metadata, YouTube thumbnail facade → inline chromeless playback (shorts portrait), X server-fetched preview (Edge-proof) + in-app mini page + searchable link-preview (`linkPreviewText` indexed by search), Facebook outbound cards, anonymous group chat (`Message.anonymous` + 🎭 mask → domino SVG), followers/following modal lists, discovery hygiene (test accounts `@snivat.local/.test` hidden from Top voices/Who to follow/People), settings phone overflow fix, Terms/Privacy second pass (AI-media, jobs shield, badges, storage) + signup checkbox
- Mobile wall **lifted** on 2026-09-12 (owner call) — install is now banner-only until proven on real devices
- Business verification live: `BusinessClaim` queue (`/verify-business` submit → `/admin/business` approve/reject) stamps `User.businessVerifiedAt`; JOB_OFFER/JOB_LISTING creation + self-serve ad creation/approval require it; ✓ Business badge on profiles + cards

## What's Left — Next Up (single source of truth, replaces PENDING.md for recent work)

**Needs owner action (2-min each, blocking):**
- [ ] Paste Stripe test keys (`sk_test_...` + `whsec_...`) → run $1 end-to-end (Stripe Checkout + webhook dormant until keys exist)
- [ ] Set `DEMO_CODE_3` in Vercel env for `verify.1787750016566@snivat.test` (slot shipped in `auth.ts`, redeploy to activate)
- [ ] `CRON_SECRET` on Vercel → activates nightly story-asset purge (code exists, env-gated)
- [ ] `DISCORD_WEBHOOK_URL` → GitHub secret → activates daily bridge bot
- [ ] Lawyer review before charging real money (Terms/Privacy are truthful baseline for founding-500, not legal guarantee)

**Queued builds (small, ordered):**
- [ ] Business proof / verification badge — **spec needed**: user asked "if someone owns business how would they even put a proof" → design: submit proof (domain, registration, or social) → admin verify → badge on profile/posts. Not started.
- [ ] "How I made this" process attachments for before/after posts — knowledge-utility loop (seeds, workflow, steps). Specced as next cycle, deferred.
- [ ] Upload orphan sweeper cron — ledger write-path live, deletion cron explicitly deferred to ~1k users (server storage leak is slow)
- [ ] Feed slider sensors (`first_drag_ms`, `return_count`, `rest_position`, `drag_but_no_reaction`) — taxonomy filed in `artifacts/feed-sensors-and-principles`, instrumentation deferred until hundreds of users (volunteered signals, not passive dwell)

**Polish / backlog (still valid from PENDING.md):**
- [ ] Music chips UI on notes (`Story.musicUrl` + `musicTitle` columns live, UI not wired)
- [ ] Groups directory rich cards upgrade (needs `Group.category` filter chips)
- [ ] Challenge feed ranking boost / ending-soon surfacing (chip live, ranker boost deferred)
- [ ] Password-reset email delivery to all users (works for owner email; needs $10/yr domain for deliverability)
- [ ] Weekly community recap email
- [ ] Push notifications end-to-end verification on real device (infra exists, lock-screen delivery proven once, device-specific flakiness remains)
- [ ] Stripe self-serve funding polish + ad viewability beacon wiring (Phase 1-3 shipped per `artifacts/ads-monetization-audit`)

**Deliberately deferred (don't build without asking):**
- Hosted video uploads (Cloudinary video $), live video/audio calls (moderation), typing indicator (presence infra), GIF picker (Tenor), Groups v2 channels/roles, VS Code presence extension, brand-sponsored Quests

**Demo / test accounts in prod (5):**
- `demo@snivat.local` / `snivat-dream` (Demo User, admin) — `DEMO_CODE`
- `demo2@snivat.local` / `733c...` (Demo User 2, admin) — `DEMO_CODE_2`
- `verify.1787750016566@snivat.test` (Verify Walker, member, test residue) — `DEMO_CODE_3` slot, needs env + temp pw `Walker-Temp-5070`
- `kinggren8@gmail.com` (Snívať OFFICIAL, admin)
- `pmon58361@gmail.com` (NAME, admin — you)

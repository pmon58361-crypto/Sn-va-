# PENDING — everything not shipped yet

Last updated: 2026-09-04. Everything else is LIVE on prod (see README.md for the full feature list).

## Building now

- [x] Discord-style DM hover toolbar — LIVE in DmThread.tsx (verified 2026-09-04)
- [ ] Music chips UI on notes (musicUrl column is live in DB) — worker E
- [x] Polls UI on posts — LIVE (Poll/PollVote tables + PollBox + composer, verified 2026-09-04)
- [ ] Groups Discovery-style directory upgrade (rich cards, live online counts, categories — category column needs the next schema window) — worker F

## Needs one schema window (batched)

- [x] Challenge model + Post.challengeId — CODE DONE (93259a2), unpushed
- [ ] Message.imageUrl (DM photo attachments — Wave 2)
- [ ] PushSubscription model (endpoint/p256dh/auth per user — Wave 2 push)
- [ ] Groups category column (for directory filter chips)
- [ ] musicTitle column (real song titles on note chips instead of URL-derived)
- [ ] Notification preferences UI (columns already live: notifyMessages, weeklyDigest)

## Blocked on owner ($10/yr domain — unlocks full email delivery)

- [ ] Password-reset emails delivering to ALL users (works for owner email today)
- [ ] Weekly community recap email

## Blocked on owner (2-min setups)

- [ ] `CRON_SECRET` env var on Vercel (activates the nightly story-asset purge)
- [ ] Discord webhook URL → GitHub secret `DISCORD_WEBHOOK_URL` (activates the daily bridge bot)

## Wave 2 (post-launch, by priority)

- [ ] Push notifications (replies/reactions — biggest retention lever)
- [ ] Weekly challenge system (community contests — becomes the Quests infrastructure)
- [ ] Profile hover cards (avatar click → mini profile popover)
- [ ] DM image attachments (Message.imageUrl column + upload wiring)

## Deliberately deferred (with reasons)

- [ ] Video/audio calls — live content cannot be moderated; revisit with revenue + moderation staff
- [ ] Hosted video uploads — storage/bandwidth/moderation cost; link embeds cover the need at $0
- [ ] Typing indicator — needs presence infrastructure beyond the current heartbeat
- [ ] GIF picker — needs a provider integration (Tenor free tier candidate)
- [ ] Groups v2 (channels, roles, group chat) — v1 feed model fits the current community size
- [ ] VS Code / external-app presence extension — store review + permission friction; manual custom status covers it
- [ ] Brand-sponsored Quests (Discord Orbs model) — needs real reach before brands pay; builds on the weekly challenge system

## Known infrastructure note (documented, not migrating)

- [ ] Vercel production and the local dev environment point at DIFFERENT Neon database branches (Vercel uses a Neon-integration branch; local .env uses the manual `ep-square-smoke-at3rpw20` branch). The platform works as deployed; owner may consolidate to ONE branch someday so local dev and prod share data. Until then: schema changes must be pushed to BOTH branches (local branch for development, prod branch via Vercel dashboard env or Neon console).

## Known minor issues

- [ ] Poll shape reconciliation (worker E vs executed window draft — empty tables, zero lock-in)
- [ ] Instagram embeds show a login wall for private/restricted Reels (Instagram-side, graceful fallback exists)
- [ ] Light-theme accent consistency pass (gold default rolling out)

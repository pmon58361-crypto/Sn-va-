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
- [x] Notification preferences UI (toggles live in SettingsForm; push toggle added Wave 2)

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

## Known infrastructure note (corrected 2026-09-07 — the old two-branch
assumption below is STALE)

- [x] Wave-2 schema window FULLY LIVE on prod (verified live 2026-09-07):
  Challenge + Post.challengeId, Message.imageUrl, PushSubscription,
  Group.category, Story.musicTitle — all serving real traffic. A `db push`
  from the local .env covers prod too (shared Neon branch), so no separate
  prod push is needed. If Vercel env ever points elsewhere, fall back to
  the Neon-console SQL files in C:\dev\snivat-prod-schema-window.sql.
- [ ] Owner may still consolidate env docs so the next agent doesn't
  re-learn this the hard way.

## Known minor issues

- [ ] Poll shape reconciliation (worker E vs executed window draft — empty tables, zero lock-in)
- [ ] Instagram embeds show a login wall for private/restricted Reels (Instagram-side, graceful fallback exists)
- [ ] Light-theme accent consistency pass (gold default rolling out)

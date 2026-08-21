
---

## RECOVERY LOG — 2026-08-21

This folder = clone of github.com/pmon58361-crypto/Sn-va- = the codebase
matching the live sn-va.vercel.app deployment (verified via landing copy,
RightSidebar activity feed, composer placeholder).

Fixes applied during recovery:
1. auth.ts: + trustHost:true (same UntrustedHost bug found in stale copies)
2. .env DATABASE_URL: pooler host -> direct host (pooler endpoint dead;
   direct endpoint verified working)
3. page.tsx + layout.tsx: + force-dynamic so builds never need the DB
   (layout renders RightSidebar which queries posts)

Verified: build PASS, all routes 200, demo login -> JWT session OK.
Known: local Neon DB holds only demo data; production's real DATABASE_URL
lives in Vercel env vars (needs ercel login to pull).

---

## FEATURE BUILD — 2026-08-21: DMs + Stories (+ social layer)

### Schema (pushed to Neon)
- Message (sender/recipient, readAt, indexes) — DM threads
- Story + StoryView (24h expiry, lazy cleanup on read, seen/unseen)
- Follow + Bookmark (social layer for next iterations)

### DMs
- /dm: thread list w/ last-message preview, unread badges, start-new chips
- /dm/[id]: X-style bubbles, optimistic send, 4s polling via
  GET /api/dm/[userId]?after=<ts>, auto mark-read on open
- Sidebar 'DM's' placeholder replaced with real link

### Stories
- StoriesBar above composer: gradient rings (unseen) / gray (seen),
  Your-story + button opens composer (text-on-color or photo upload
  to Cloudinary snivat/stories), 6 bg choices
- Full-screen viewer: progress bars, tap zones, keyboard esc,
  auto-advance 5s, view counts on own stories, marks viewed

### Verified
- tsc PASS, build PASS, login OK
- /dm renders conversations; unread badge shows; thread page 200;
  poll API returns JSON; stories rail renders; test data cleaned up

### Notes
- cloudinary dep added to this repo (was missing); CLOUDINARY_URL reused
- Real multi-user DM/story testing needs a second account (sign up via GitHub)

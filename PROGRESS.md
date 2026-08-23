
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

---

## STORAGE + MODERATION + PERF PASS - 2026-08-22

### Performance (why pages were slow)
- Root causes found: /jobs fetched TWO full ranked feeds just for tab
  counts (~8 wasted Neon round trips); community page chained 3 sequential
  query waves; getPosts ran pool -> affinity -> velocity groupBys
  sequentially; DNABackground canvas burned CPU app-wide.
- Fixes: jobs badges are prisma.post.count now (one wave); community
  fetches parallelized; getPosts folds affinity + 12h velocity into ONE
  Promise.all wave with the pool query; DNA canvas removed entirely
  (creator decision). Landing keeps its own aurora aesthetic.

### Storage ($0)
- src/lib/cdn.ts: cdnUrl() injects f_auto,q_auto,w_<w> into Cloudinary
  URLs at render time (feed 720/640, detail 1080/1400, stories 900,
  thumbs 160-480). Non-Cloudinary URLs pass through (OAuth avatars,
  legacy /uploads). Cuts free-tier bandwidth massively.
- src/lib/storage.ts: destroyAssets() derives public_ids from stored
  URLs (works retroactively) and batch-deletes on: deletePost,
  savePost image-replacement, deleteStory, deleteHighlight (with
  reference checks so shared story/post images survive).
- Daily upload cap: 40/day/user across posts+stories (DAILY_UPLOAD_CAP),
  enforced in /api/upload via new PostImage.createdAt column.

### Moderation ($0, no AI APIs)
- Schema pushed: Post.hidden, User.bannedAt, User.role now "member|admin",
  Report polymorphic (POST/COMMENT/MESSAGE/STORY + status open/dismissed/
  actioned + moderatorId).
- src/lib/session.ts: requireUserId / requireActiveUser (ban check on
  every write) / requireAdmin. ADMIN_EMAILS env auto-promotes.
- Banned users: blocked at credentials authorize(), OAuth signIn callback,
  and every server action write.
- reportTarget() replaces reportPost for all content types; posts
  auto-hide at >= 3 distinct reporters (AUTO_HIDE_THRESHOLD).
- Hidden enforcement: getPosts/getTopTags/RightSidebar/profile grids
  filter hidden; detail pages 404 for strangers but show a banner to
  author/admin.
- /admin dashboard (Sidebar link, admins only): grouped report queue with
  reasons/reporters, hidden-post list, actions: dismiss+restore, hide,
  hard-delete (+asset destroy), ban/unban. Stats strip + Cloudinary
  usage glance (free admin API).
- Report UI everywhere: comments (CommentList), DM bubbles (DmThread),
  story viewer (ReportMenu component, preset reasons).

### Wordlist block
- src/lib/filter.ts assertClean() on savePost/addComment/sendMessage/
  createStory. Hard blocks ONLY (slurs/illegal); nuance goes to reports.

### Verified
- tsc PASS, next build PASS (/admin in manifest), server restarted OK.
- Routes smoke: public 200; auth-gated 307; /admin redirects non-admins.
- Live-DB test: 4 distinct reports flipped hidden=true, then cleanup OK.
- cdnUrl passthrough confirmed against real rows.

---

## LOGO - 2026-08-23

- Final mark shipped: waxing crescent + wish-star, gold gradient
  (#f5e6b8->#c9a24b) on night tile (#1a1d22->#0d0e11), rx 29.
  Geometry verified numerically: 19px limb thickness reads at 16px;
  star sits fully inside the hollow without touching the gold.
- public/logo.svg = mark; src/app/icon.svg = same (favicon);
  public/logo-lockup.svg = horizontal lockup with correct UTF-8
  "Snívat" wordmark (old one had mojibake text).
- Earlier drafts kept as public/logo-a|b|c.svg for reference.

---

## LOGO v2 - 2026-08-23

- Replaced crescent concept (read "sleep app", not the brand) with an
  S-monogram mark: one drifting monoline gold S + 4-point sparkle as
  its "period" — revives the V2 "S." wordmark identity, fuses name
  initial with the dream spark.
- Same night tile (#1a1d22->#0d0e11) and gold ramp (#f5e6b8->#c9a24b)
  so it sits flush beside the Sní/white+vat/gold wordmark everywhere.
- Updated: public/logo.svg, src/app/icon.svg, public/logo-lockup.svg.
  All XML-validated. Crescent variant retired (user rejected).

---

## LOGO v3 (fancy S) - 2026-08-23

- Rebuilt mark as a sculpted two-part S: two tapered gold hooks
  (filled crescents, knife-edge tips) counter-rotated 180deg around
  center, dream-spark suspended in the central void. Reads as a
  luxury monogram instead of a handwritten stroke.
- Flat fills (#e6c065 body, #fff7e0 spark) with per-hook gradient
  direction in logo.svg; lockup uses flat fills + shared masks
  (mask coords are pre-translate group space).
- Files: public/logo.svg, src/app/icon.svg, public/logo-lockup.svg.
  All XML-valid; geometry numerically verified (no hook overlap,
  spark centered in void, no corner clipping).

---

## LOGO v4 (final direction) - 2026-08-23

- Pill-segment S abandoned (rendered as digit 5 - two rounds of fixes
  could not escape the 5 anatomy). Constellation + crescent + pills all
  archived as logo-a/b/c/moon.svg lineage.
- FINAL: typeset mark - high-contrast serif S (Instrument Serif stack,
  Georgia fallback) in gold vertical ramp on night tile, 4-point
  dream-spark as the period. Revives V2's literal "S." identity with
  editorial typography matching the landing.
- public/logo.svg, src/app/icon.svg, public/logo-lockup.svg updated.

---

## LOGO v5 (FINAL: chasing arrows) - 2026-08-23

- Concept: two gold arrows locked in an S-chase = the
  dream->build->grow loop; pair = connection, formation = S.
  Replaces all prior directions (crescent/constellation/pills/serif/
  stock-trace attempt - user rejected each).
- Geometry: two mirrored stroke paths (60w, round joins) + filled
  arrowheads; gradient f7ecc9->c99b3f on night tile rx110.
- Files: logo.svg, icon.svg, logo-mark-black.svg (transparent),
  logo-lockup.svg. All XML-valid.

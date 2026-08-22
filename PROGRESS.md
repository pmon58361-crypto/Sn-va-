
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

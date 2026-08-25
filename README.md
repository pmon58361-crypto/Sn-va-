# Snívať

**Dream. Grow. Connect.**

Snívať (Slovak for *"to dream"*) is a community where people grow together —
share progress publicly, find collaborators and work, and keep up with the
people you follow. It is deliberately **not a job board and not LinkedIn**:
no follower counts as status, no engagement games. Just a quiet, fast feed,
honest numbers, and tools that respect your attention.

---

## What's inside

| Area | What you get |
|---|---|
| **Community** | A ranked "For you" feed plus a chronological "Following" tab, threaded comments, reactions, bookmarks, topic tags |
| **Stories** | 24-hour Instagram-style story circles with seen/unseen rings, text notes, photo uploads, and a personal archive |
| **Jobs & Applications** | Work offers ("I do this"), work requests ("I need someone"), and open listings with a one-message apply flow |
| **Profiles** | Highlights collections, stats strip, follow graph, public/private privacy control |
| **Direct messages** | Per-user threads with read receipts, unread badges, and starter prompts for brand-new conversations |
| **Creator dashboard** | Real analytics from database events only — range switcher, tabbed SVG charts, period-over-period deltas, recent posts. Never estimated, never faked |
| **Notifications** | In-app notifications for comments, reactions, follows, applications and messages |
| **Moderation** | Community reporting with an admin queue, hide/restore, bans, and Cloudinary storage visibility |
| **PWA** | Installable app, offline page, service-worker asset caching with explicit version bumps |

### Privacy by default

- Zero third-party tracking, pixels or ads scripts
- Emails are visible only to their owner; profile handles derive from names
- Self-deactivation is built in: hide your entire account instantly, sign back
  in to restore everything — reversible, nothing deleted

---

## Tech stack

- [Next.js 15](https://nextjs.org/) App Router + React 18, TypeScript strict
- [Prisma 5](https://www.prisma.io/) + PostgreSQL ([Neon](https://neon.tech) serverless in production)
- [Auth.js v5](https://authjs.dev/) (JWT sessions) — GitHub, Google, Facebook, Microsoft and Yahoo OAuth wired up, plus a credentials path with bcrypt hashing
- [Cloudinary](https://cloudinary.com/) for image storage with reference-aware garbage collection
- [Tailwind CSS](https://tailwindcss.com/) theming through CSS variables — dark/light plus user-chosen accent and background presets
- Pure-SVG charts and hand-rolled components; the dependency list stays short on purpose

---

## Quick start

Requirements: Node 18+, a PostgreSQL database (local or Neon).

```bash
git clone https://github.com/pmon58361-crypto/Sn-va-.git
cd snivat            # repository folder
npm ci               # installs deps and runs prisma generate automatically
```

Create `.env` (see `.env.example`):

```ini
DATABASE_URL="postgresql://…"     # Neon or local Postgres
AUTH_SECRET="random-string"       # openssl rand -base64 32
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# Optional — instant demo sign-in without any setup:
DEMO_CODE="letmein"               # access-code login
DEMO_EMAIL="demo@snivat.local"
DEMO_PASSWORD="demo1234"

# Optional providers — each activates when its keys exist:
# AUTH_GITHUB_ID / AUTH_GITHUB_SECRET, AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET,
# AUTH_FACEBOOK_ID / AUTH_FACEBOOK_SECRET, AUTH_MICROSOFT_ID / AUTH_MICROSOFT_SECRET,
# AUTH_YAHOO_ID / AUTH_YAHOO_SECRET, CLOUDINARY_URL, ADMIN_EMAILS
```

Push the schema and run:

```bash
npm run db:push        # create tables (safe on an empty database)
npm run dev            # http://localhost:3000
```

Sign in with the access code (`DEMO_CODE`) or `demo@snivat.local` /
`demo1234` to explore immediately.

> For production builds, run `npm run build && npm start`. On Windows,
> `npm start` wraps `start.ps1`, which frees port 3000 and rebuilds
> `.next` if corruption is detected.

---

## 🔑 Enabling real OAuth (optional)

The four OAuth providers are wired up but stay hidden until you add their keys.

1. Copy `.env.example` → `.env`
2. Create an OAuth app at each provider and paste the Client ID + Secret:
   - **GitHub** — https://github.com/settings/developers
   - **Google** — https://console.cloud.google.com/apis/credentials
   - **Facebook** — https://developers.facebook.com/apps/
   - **Yahoo** — https://developer.yahoo.com/apps/
3. Set `AUTH_SECRET` to a random string (`openssl rand -base64 32`).
4. Set `NEXT_PUBLIC_APP_URL` to your final URL.
5. Restart the dev server. Provider buttons become clickable.

> **Note:** For production, make sure each provider's authorized redirect URI is set to `https://YOUR_DOMAIN/api/auth/callback/<provider>`.

---

## 🛠️ Tech stack

- **[Next.js 15](https://nextjs.org/)** (App Router) — full-stack React framework
- **[Prisma](https://www.prisma.io/)** — type-safe database client
- **[Auth.js v5 / NextAuth](https://authjs.dev/)** — OAuth + credentials auth
- **[Tailwind CSS](https://tailwindcss.com/)** — styling, white/red theme via CSS variables
- **[ogl](https://github.com/oframe/ogl)** — tiny WebGL library, used ONLY by the landing page's `SpecularButton` CTA (user-requested addition, 2026-08-25). No other component depends on it.
- **TypeScript** end-to-end

---

## Project structure

```
src/
├── app/
│   ├── admin/              # Moderation queue (role-gated) + actions
│   ├── api/                # auth handlers, upload, dm, notifications
│   ├── auth/signin/        # Sign-in (OAuth buttons + access code)
│   ├── community/          # Main feed + post detail
│   ├── jobs/ applications/ # Work sections + detail pages
│   ├── dashboard/          # Creator analytics
│   ├── dm/                 # Conversations + thread view
│   ├── people/ profile/    # Directory and profiles (highlights included)
│   ├── settings/           # Account / appearance / interests / privacy tabs
│   └── stories/ highlights/# Server actions for ephemeral + curated content
├── auth.ts                 # Auth.js config: throttling, providers, callbacks
├── components/
│   ├── layout/             # Navbar, Sidebar, BottomNav, RightSidebar
│   ├── posts/ stories/ dm/ # Feed cards, composers, thread UI
│   ├── dashboard/ pwa/     # Analytics charts, install prompt
│   └── ui/                 # Icons, Avatar, Logo primitives
├── lib/                    # prisma, queries, feed ranking, session cache, utils
└── middleware.ts           # Auth error self-healing
prisma/schema.prisma        # 20 models — additive-only evolution policy
public/sw.js                # Service worker; VERSION bumps on asset changes
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Prisma generate + production build |
| `npm start` | Production server via `start.ps1` |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Insert sample users and posts |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run smoke` | Route-level smoke checks |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run check` | tsc + e2e + smoke in one gate |

---

## Operating notes

- **Schema changes are additive only.** Columns are added, never dropped or
  retyped, and pushes run exclusively from a worktree whose
  `prisma/schema.prisma` matches origin/main HEAD (verified with
  `prisma migrate diff`). This policy exists because a stale checkout once
  dropped a column from the shared database.
- **Service worker:** bump `VERSION` in `public/sw.js` whenever anything in
  `public/` changes, or returning PWA users will serve stale assets.
- **Real data only:** every number shown in product or analytics comes from
  actual events. Nothing is estimated or simulated.

---

## Credits

Snívať is **built by a room of AI agents** — that's not marketing, it's the
actual process. A coordinator agent holds the roadmap and sequences deploys;
worker agents claim tickets, develop in isolated git worktrees, and hand
gated commits to a single integrator who runs the merge train, rehearses
type-checks, ships, smokes production and reverts on red. Humans set the
taste, the priorities and the guardrails; the agents do the typing.

The result is an app designed the way good teams actually work: small
reversible changes, honest metrics, one deployer at a time.

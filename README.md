# 🐝 Snívať

A full-stack **job application + community** platform built with Next.js.

Find work, find workers, and share your story — all in one place.

---

## ✨ Features

| Section | What it's for |
|---|---|
| **Community** | Share experiences, ask for advice, hold threaded discussions |
| **Jobs** | Two tabs — **Work Offers** ("I do this work") and **Work Requests** ("I need someone") |
| **Applications** | Browse job openings and apply with a single message |

**Core capabilities**

- 🔐 **Sign in** with **GitHub, Google, Facebook, Yahoo**, or the built-in **demo account** (works instantly, zero setup)
- 🖼️ **Image uploads** — drag & drop, up to **100 images per post**, enforced server-side
- 🎨 **System settings** — profile, light/dark theme, accent color (default red), privacy & notification toggles
- 💬 **Comments** on community & job posts
- 📨 **Job applications** with a per-listing applicant dashboard for the post owner
- 👤 **Public profiles** showing a user's posts
- ⚪ **White background + red primary** theme (fully recolorable in Settings)

---

## 🚀 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create the database + run migrations (creates prisma/dev.db)
npx prisma db push

# 3. Seed sample users + posts (optional but recommended)
npm run db:seed

# 4. Start the dev server
npm run dev
```

Open **http://localhost:3000**.

### Sign in

The app ships with a **demo account** so you can explore immediately:

| Field | Value |
|---|---|
| Email | `demo@snivat.local` |
| Password | `demo1234` |

On the sign-in page these are prefilled — just press **Sign in**.

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

## 📁 Project structure

```
src/
├── app/
│   ├── actions.ts            # Server actions (save/delete posts, comments, apply)
│   ├── api/
│   │   ├── auth/[...nextauth]/  # Auth.js route handlers
│   │   └── upload/              # Image upload API
│   ├── auth/signin/          # Sign-in page (OAuth + demo)
│   ├── community/            # Community list + [id] detail
│   ├── jobs/                 # Jobs list (offer/request tabs) + [id] detail
│   ├── applications/         # Job applications list + [id] detail + apply
│   ├── settings/             # Settings page + form + action
│   ├── profile/[id]/         # Public profile
│   ├── new/                  # Create post
│   ├── layout.tsx            # Root layout (navbar/footer/providers)
│   └── page.tsx              # Landing page
├── auth.ts                   # Auth.js config (providers, callbacks)
├── components/               # Navbar, Footer, PostCard, ImageUploader, etc.
└── lib/                      # prisma client, queries, types, utils
prisma/
├── schema.prisma             # Database models
└── seed.js                   # Sample data
```

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run db:push` | Create/apply schema to the SQLite file |
| `npm run db:seed` | Insert sample users + posts |
| `npm run db:studio` | Open Prisma Studio (GUI for the DB) |

---

## ⚠️ Notes

- **OneDrive sync:** if you keep this project inside a OneDrive folder, the `node_modules` directory (thousands of tiny files) can slow sync or cause lock errors. Consider excluding the project folder from OneDrive sync, or moving it outside OneDrive.
- **Storage:** uploaded images are saved to `public/uploads/` (git-ignored). For production, swap the upload route for a cloud provider (S3, Cloudinary, etc.).
- **Database:** SQLite is great for local/demo use. For production, change the Prisma `datasource` to Postgres/MySQL.

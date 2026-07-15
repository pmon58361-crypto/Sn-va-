# Snívať — Working Guidelines

How to build Snívať. For the product vision, brand, and audience, see `PRODUCT.md`.

---

## Tech Stack

- Next.js 15 with App Router
- React 18.3.1 (**NOT React 19** — do not use React 19-only APIs like `useActionState`)
- TypeScript
- Prisma with SQLite
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

## Current State

- Project builds and compiles cleanly
- Dev server runs on localhost:3000
- Posting, photo upload, auth, community, jobs, applications, settings, and profile pages all exist
- **Demo login:** `demo@snivat.local` / `demo1234` (ensure database is seeded)

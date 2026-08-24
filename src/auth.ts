import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  fetchSessionUser,
  readFresh,
  readStale,
  writeSessionUser,
} from "@/lib/session-cache";

// ── Sign-in throttling (in-memory, per-identifier exponential lockout) ──────
//
// Failed credentials sign-ins back off exponentially per email (or a shared
// bucket for access-code attempts, where no email exists): 1s, 2s, 4s …
// capped at 15 minutes. Successful sign-in clears the record. This is
// brute-force friction, not identity policy — ban enforcement stays in DB.

type SignInAttempt = { count: number; lockUntil: number };

const signInAttempts =
  (
    globalThis as unknown as {
      __snivatSignInThrottle?: Map<string, SignInAttempt>;
    }
  ).__snivatSignInThrottle ??= new Map<string, SignInAttempt>();

const BASE_LOCK_MS = 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;

/** Length-independent constant-time string comparison. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function isLockedOut(key: string): boolean {
  const rec = signInAttempts.get(key);
  return !!rec && rec.lockUntil > Date.now();
}

function recordFailure(key: string) {
  // Hard cap so a flooding attacker can't grow the map unbounded.
  if (signInAttempts.size > 10_000) signInAttempts.clear();
  const rec = signInAttempts.get(key) ?? { count: 0, lockUntil: 0 };
  rec.count += 1;
  const delay = Math.min(
    BASE_LOCK_MS * 2 ** Math.min(rec.count - 1, 10),
    MAX_LOCK_MS
  );
  rec.lockUntil = Date.now() + delay;
  signInAttempts.set(key, rec);
}

// Yahoo has no dedicated provider in Auth.js v5, so we register it as a custom
// OAuth2 provider against Yahoo's public endpoints. It only activates when
// AUTH_YAHOO_ID / AUTH_YAHOO_SECRET are present in the environment.
const Yahoo = {
  id: "yahoo",
  name: "Yahoo",
  type: "oauth" as const,
  wellKnown: "https://api.login.yahoo.com/.well-known/openid-configuration",
  authorization: { params: { scope: "openid email profile" } },
  profile(profile: Record<string, unknown>) {
    return {
      id: String(profile.sub || profile.id || ""),
      name: (profile.name as string) || (profile.nickname as string) || null,
      email: (profile.email as string) || null,
      image: (profile.picture as string) || null,
    };
  },
};

// Verify credentials (demo access-code or email+password). Returns the user
// on success, null on failure. Throttling wraps this in authorize().
async function verifyCredentials(
  credentials: Partial<Record<string, unknown>> | undefined
): Promise<{
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
} | null> {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;

  // --- Access-code paths: each valid code signs into its demo account.
  // Codes live only server-side, so they never ship to the client.
  const code = (credentials?.code as string | undefined)?.trim();
  if (code) {
    const demoPaths = [
      {
        expected: process.env.DEMO_CODE,
        email: (
          process.env.DEMO_EMAIL || "demo@snivat.local"
        ).toLowerCase(),
      },
      {
        expected: process.env.DEMO_CODE_2,
        email:
          process.env.DEMO_EMAIL_2?.toLowerCase() ||
          "demo2@snivat.local",
        name: "Demo 2",
      },
    ];
    // Constant-time compare: the demo code is a bearer secret.
    const match = demoPaths.find(
      (p) => !!p.expected?.trim() && constantTimeEqual(code, p.expected.trim())
    );
    if (!match) return null;

    let user = await prisma.user.findUnique({
      where: { email: match.email },
    });
    // The second demo account self-creates on first use so no seed run
    // is needed on production (mirrors the seed.js user shape).
    if (!user && match.name) {
      user = await prisma.user.create({
        data: {
          email: match.email,
          name: match.name,
          provider: "credentials",
          role: "member",
          accounts: {
            create: {
              type: "credentials",
              provider: "credentials",
              providerAccountId: match.email,
            },
          },
          settings: { create: {} },
        },
      });
    }
    if (!user || user.bannedAt) return null;
    // Self-deactivation is reversible: signing back in restores the account.
    if (user.deactivatedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { deactivatedAt: null },
      });
    }
    return { id: user.id, name: user.name, email: user.email, image: user.image };
  }

  // --- Legacy email + password path ---
  if (!email || !password) return null;

  // Find user. For the seeded demo account we validate the password.
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) return null;

  // Banned accounts can't sign in (any provider).
  if (user.bannedAt) return null;

  // Demo account password check (only credentials-provider users store a password hash
  // by convention — we keep it on a dedicated Account row's token).
  const demoEmail = (process.env.DEMO_EMAIL || "demo@snivat.local").toLowerCase();
  const demoPass = process.env.DEMO_PASSWORD || "demo1234";

  if (email.toLowerCase() === demoEmail) {
    if (constantTimeEqual(password, demoPass)) {
      await reactivateIfNeeded(user.id, user.deactivatedAt);
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    }
    return null;
  }

  // Any other credentials user: look up a stored hash on their credentials Account row.
  const acc = await prisma.account.findFirst({
    where: { userId: user.id, provider: "credentials" },
  });
  if (acc?.refresh_token) {
    // We reuse refresh_token to store the bcrypt hash (cheap reuse, avoids schema churn).
    const ok = await bcrypt.compare(password, acc.refresh_token);
    if (ok) {
      await reactivateIfNeeded(user.id, user.deactivatedAt);
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    }
  }
  return null;
}

/** Clear a self-deactivation when the owner proves their identity again. */
async function reactivateIfNeeded(
  userId: string,
  deactivatedAt: Date | null
): Promise<void> {
  if (!deactivatedAt) return;
  await prisma.user.update({
    where: { id: userId },
    data: { deactivatedAt: null },
  });
}

// Build the list of providers that actually have credentials configured.
// The demo Credentials provider is ALWAYS available so the app runs with zero setup.
function buildProviders() {
  const providers = [];

  // --- Demo / credentials login (always on) ---
  providers.push(
    Credentials({
      name: "Demo login",
      credentials: {
        code: { label: "Access code", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const code = (credentials?.code as string | undefined)?.trim();

        // Per-identifier lockout: exponential backoff on repeated failures.
        // Access-code attempts share one bucket (no email is supplied there).
        const key = email
          ? `e:${email.toLowerCase()}`
          : code
          ? "code"
          : "anon";
        if (isLockedOut(key)) return null;

        const user = await verifyCredentials(credentials);
        if (user) {
          signInAttempts.delete(key);
          return user;
        }
        recordFailure(key);
        return null;
      },
    })
  );

  // --- OAuth providers (only added if client id+secret exist in env) ---
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(GitHub({ allowDangerousEmailAccountLinking: true }));
  }
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(Google({ allowDangerousEmailAccountLinking: true }));
  }
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
    providers.push(Facebook({ allowDangerousEmailAccountLinking: true }));
  }
  if (process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET) {
    providers.push(
      MicrosoftEntraID({ allowDangerousEmailAccountLinking: true })
    );
  }
  if (process.env.AUTH_YAHOO_ID && process.env.AUTH_YAHOO_SECRET) {
    providers.push(Yahoo as never);
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/auth/signin" },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user }) {
      // OAuth path: block banned accounts at sign-in too. Self-deactivated
      // accounts reactivate on sign-in (same rule as the credentials path).
      if (user?.id) {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { bannedAt: true, deactivatedAt: true },
        });
        if (row?.bannedAt) return false;
        await reactivateIfNeeded(user.id, row?.deactivatedAt ?? null);
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;
      }
      if (account?.provider) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.provider = (token.provider as string) || "credentials";

        // Identity and preferences come fresh from the DB on every request,
        // so name/avatar edits apply immediately (no re-login needed) and
        // saved theme/accent follow the account across browsers.
        // Safe to use Prisma here: this callback runs in Node route
        // handlers — middleware no longer imports this file.
        if (token.id) {
          const id = token.id as string;

          // Degradation ladder (Neon blips must not take auth down):
          //   1. fresh cache hit (<=45s old)
          //   2. DB fetch -> cached
          //   3. DB throw -> stale cache even if expired
          //   4. nothing  -> bare JWT claims (name/email/picture from login)
          // Failures are never cached; user-deleted stays "base session".
          let user = readFresh(id);
          if (!user) {
            try {
              user = await fetchSessionUser(id);
              if (user) writeSessionUser(id, user);
            } catch (err) {
              console.warn(
                "[auth] session identity fetch failed, degrading:",
                err
              );
              user = readStale(id);
            }
          }

          // Confirmed self-deactivation reads as signed out everywhere:
          // no id on the session means every requireActiveUser/requireUserId
          // gate throws and every page renders its guest state. Only a
          // CONFIRMED flag strips the id — a degraded/failed lookup keeps
          // today's behavior (bare JWT claims).
          if (user?.deactivatedAt) return session;

          session.user.id = id;
          if (user) {
            session.user.name = user.name;
            session.user.image = user.image;
            session.user.role = user.role;
            session.user.theme = user.theme;
            session.user.accent = user.accent;
            session.user.background = user.background || undefined;
            session.user.isCreator = user.isCreator ?? false;
          }
        }
      }
      return session;
    },
  },
});



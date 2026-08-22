import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

// Build the list of providers that actually have credentials configured.
// The demo Credentials provider is ALWAYS available so the app runs with zero setup.
function buildProviders() {
  const providers = [];

  // --- Demo / credentials login (always on) ---
  providers.push(
    Credentials({
      name: "Demo login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
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
          if (password === demoPass) {
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
            return { id: user.id, name: user.name, email: user.email, image: user.image };
          }
        }
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
      // OAuth path: block banned accounts at sign-in too.
      if (user?.id) {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { bannedAt: true },
        });
        if (row?.bannedAt) return false;
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
        session.user.id = token.id as string;
        session.user.provider = (token.provider as string) || "credentials";

        // Identity and preferences come fresh from the DB on every request,
        // so name/avatar edits apply immediately (no re-login needed) and
        // saved theme/accent follow the account across browsers.
        // Safe to use Prisma here: this callback runs in Node route
        // handlers — middleware no longer imports this file.
        if (token.id) {
          const user = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              name: true,
              image: true,
              settings: {
                select: { theme: true, accent: true, background: true },
              },
            },
          });
          if (user) {
            session.user.name = user.name;
            session.user.image = user.image;
            session.user.theme = user.settings?.theme;
            session.user.accent = user.settings?.accent;
            session.user.background = user.settings?.background || undefined;
          }
        }
      }
      return session;
    },
  },
});



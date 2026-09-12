"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { findBlockedTerm } from "@/lib/filter";
import { REF_COOKIE, resolveRef } from "@/lib/referral";

// ── Open registration (launch-critical) ──────────────────────────────────────
//
// Creates credentials accounts: bcrypt hash rides Account.refresh_token
// (the documented pre-existing convention — no schema change), User +
// credentials Account + Settings rows mirror the demo self-create shape.
//
// Abuse friction: per-email exponential lockout on failed creations
// (same shape as the sign-in throttle in src/auth.ts). Secrets are never
// logged — nothing here writes to console at all.

type Attempt = { count: number; lockUntil: number };

const attempts =
  ((globalThis as unknown as {
    __snivatSignupThrottle?: Map<string, Attempt>;
  }).__snivatSignupThrottle ??= new Map<string, Attempt>());

const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

// ── Mass-signup friction ─────────────────────────────────────────────────────
// The per-email lockout above only counts FAILURES — successes are unlimited,
// so a script could mint accounts all day. This per-IP hourly budget
// (generous: 30) raises that bar. Best-effort by design: in-memory means
// per-instance on serverless, and it fails OPEN (email checks still apply)
// so no legit user is ever locked out by it.
const ipCreations =
  ((globalThis as unknown as { __snivatSignupIp?: Map<string, number[]> })
    .__snivatSignupIp ??= new Map<string, number[]>());

const IP_WINDOW_MS = 60 * 60_000;
const IP_MAX = 30;

async function ipOverLimit(): Promise<boolean> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") || "";
    const ip = fwd.split(",")[0].trim() || (h.get("x-real-ip") || "").trim();
    if (!ip) return false;
    const now = Date.now();
    const recent = (ipCreations.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
    if (recent.length >= IP_MAX) return true;
    recent.push(now);
    ipCreations.set(ip, recent);
    if (ipCreations.size > 10_000) ipCreations.clear();
    return false;
  } catch {
    return false;
  }
}

function isLockedOut(email: string): boolean {
  const rec = attempts.get(email);
  return !!rec && rec.lockUntil > Date.now();
}

function recordFailure(email: string) {
  if (attempts.size > 10_000) attempts.clear();
  const rec = attempts.get(email) ?? { count: 0, lockUntil: 0 };
  rec.count += 1;
  const delay = Math.min(
    BASE_LOCK_MS * 2 ** Math.min(rec.count - 1, 10),
    MAX_LOCK_MS
  );
  rec.lockUntil = Date.now() + delay;
  attempts.set(email, rec);
}

export type SignupResult = { ok: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createAccount(input: {
  name: unknown;
  email: unknown;
  password: unknown;
  /** Explicit ?ref= from the signup page URL — preferred over the cookie
   *  (covers cookie jars the middleware never saw, e.g. iOS standalone). */
  ref?: unknown;
  /** Terms + Privacy acceptance — required. The trust boundary: the
   *  client gates too, but only this check is enforceable. */
  agree?: unknown;
}): Promise<SignupResult> {
  const name = String(input?.name ?? "").trim().slice(0, 60);
  const email = String(input?.email ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const password = String(input?.password ?? "");

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  if (input?.agree !== true) {
    return {
      ok: false,
      error: "Please accept the Terms and Privacy Policy first.",
    };
  }
  if (await ipOverLimit()) {
    return {
      ok: false,
      error: "Too many accounts created from your network. Try again later.",
    };
  }
  if (isLockedOut(email)) {
    return {
      ok: false,
      error: "Too many attempts for this email. Try again in a few minutes.",
    };
  }

  if (!name) {
    recordFailure(email);
    return { ok: false, error: "Please tell us your name." };
  }
  const blocked = findBlockedTerm(name);
  if (blocked) {
    recordFailure(email);
    return { ok: false, error: "That name isn't allowed here. Pick another." };
  }

  if (password.length < 8 || password.length > 200) {
    recordFailure(email);
    return {
      ok: false,
      error: "Password must be between 8 and 200 characters.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    // Same friendly answer regardless of anything else — no enumeration aid,
    // and the message routes them to the sign-in tab they need.
    return {
      ok: false,
      error: "An account with this email already exists. Sign in instead.",
    };
  }

  const hash = await bcrypt.hash(password, 10);

  // First-touch attribution, resolved once at creation and never again.
  let refSource = "direct";
  try {
    const jar = await cookies();
    refSource = resolveRef(input?.ref, jar.get(REF_COOKIE)?.value);
  } catch {
    // Cookie jar unreadable — "direct", never a failure.
  }

  try {
    await prisma.user.create({
      data: {
        email,
        name,
        provider: "credentials",
        role: "member",
        refSource,
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: email,
            refresh_token: hash, // documented: credentials hash rides refresh_token
          },
        },
        settings: { create: {} },
      },
    });
  } catch {
    // Unique-constraint race or transient DB issue — one honest retry path.
    const stillThere = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (stillThere) {
      return {
        ok: false,
        error: "An account with this email already exists. Sign in instead.",
      };
    }
    recordFailure(email);
    return {
      ok: false,
      error: "Couldn't create your account right now. Please try again.",
    };
  }

  return { ok: true };
}

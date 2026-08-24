"use server";

import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { invalidateSessionCache } from "@/lib/session-cache";
import {
  createResetToken,
  verifyResetToken,
} from "@/lib/reset-token";

// ── Password reset (launch-critical) ─────────────────────────────────────────
//
// Request flow is deliberately silent about whether an email exists. Reset
// applies ONLY to credentials-provider accounts — OAuth users sign in with
// their provider and get a friendly pointer instead.
//
// KNOWN LIMITATION (documented, temporary): Resend's free tier delivers only
// to the account owner's email until a custom domain is verified. The flow
// is fully functional; broad delivery activates the moment a domain lands.

type Attempt = { count: number; lockUntil: number };
const attempts =
  ((globalThis as unknown as { __snivatResetThrottle?: Map<string, Attempt> })
    .__snivatResetThrottle ??= new Map<string, Attempt>());

const BASE_LOCK_MS = 60_000;
const MAX_LOCK_MS = 15 * 60_000;

function throttled(email: string): boolean {
  const rec = attempts.get(email);
  return !!rec && rec.lockUntil > Date.now();
}

function recordFailure(email: string) {
  if (attempts.size > 10_000) attempts.clear();
  const rec = attempts.get(email) ?? { count: 0, lockUntil: 0 };
  rec.count += 1;
  const delay = Math.min(BASE_LOCK_MS * 2 ** Math.min(rec.count - 1, 10), MAX_LOCK_MS);
  rec.lockUntil = Date.now() + delay;
  attempts.set(email, rec);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SimpleResult = { ok: boolean; error?: string };

export async function requestPasswordReset(
  emailRaw: unknown
): Promise<SimpleResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  if (throttled(email)) {
    return {
      ok: false,
      error: "Reset already requested for this email. Try again in a minute.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, provider: true, accounts: { select: { provider: true } } },
  });

  // Silent no-enumeration: identical success copy even when nothing was sent.
  if (!user) return { ok: true };

  const usesCredentials =
    user.provider === "credentials" ||
    user.accounts.some((a) => a.provider === "credentials");
  if (!usesCredentials) {
    // OAuth-only account: nothing to reset here, still answer identically.
    return { ok: true };
  }

  const token = createResetToken(email);
  const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://snivat.vercel.app"}/auth/reset-password?token=${token}`;

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("not-configured");
    const resend = new Resend(apiKey);
    const { error: sendErr } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Snívať password reset",
      html:
        `<p>Hi ${"there"},</p>` +
        `<p>A password reset was requested for your Snívať account.</p>` +
        `<p><a href="${link}">Set a new password</a> — this link works for 10 minutes and can be used once.</p>` +
        `<p>If you didn't request this, ignore this email; your password stays unchanged.</p>`,
      text: `Reset your Snívať password (10 min, single use): ${link}`,
    });
    if (sendErr) throw new Error("send-failed");
  } catch {
    recordFailure(email);
    // Honest failure — never claim success we can't back.
    return {
      ok: false,
      error: "Couldn't send the email right now. Please try again shortly.",
    };
  }

  return { ok: true };
}

export async function performPasswordReset(input: {
  token: unknown;
  password: unknown;
}): Promise<SimpleResult> {
  const token = String(input?.token ?? "");
  const password = String(input?.password ?? "");
  if (password.length < 8 || password.length > 200) {
    return { ok: false, error: "Password must be between 8 and 200 characters." };
  }

  const claim = verifyResetToken(token);
  if (!claim) {
    return {
      ok: false,
      error: "This reset link is invalid, expired, or already used.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: claim.email },
    select: { id: true, accounts: { select: { id: true, provider: true } } },
  });
  if (!user) {
    return { ok: false, error: "This reset link is invalid or already used." };
  }

  const credAccount = user.accounts.find((a) => a.provider === "credentials");
  if (!credAccount) {
    return {
      ok: false,
      error: "This account signs in with an external provider — no password to reset.",
    };
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.account.update({
    where: { id: credAccount.id },
    data: { refresh_token: hash }, // documented convention
  });

  invalidateSessionCache(user.id);
  return { ok: true };
}

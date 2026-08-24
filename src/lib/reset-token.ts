import { createHash, createHmac, randomBytes } from "node:crypto";

// ── Password-reset tokens (schema-free) ──────────────────────────────────────
//
// HMAC-signed payload: base64url(JSON { e: email, x: expiryMs, j: nonce }).
// Signed with AUTH_SECRET (already required in production) — no DB rows.
// Single-use enforcement: an in-memory used-nonce set. Correct for our
// single-instance deployment; multi-instance would move the set to Redis.
// 10-minute expiry, per product spec.

const TTL_MS = 10 * 60_000;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function key(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET missing — cannot sign reset tokens");
  return secret;
}

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", key()).update(payloadB64).digest());
}

export function createResetToken(email: string): string {
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        e: email.toLowerCase(),
        x: Date.now() + TTL_MS,
        j: randomBytes(8).toString("hex"),
      })
    )
  );
  return `${payload}.${sign(payload)}`;
}

const usedNonces =
  ((globalThis as unknown as { __snivatUsedResets?: Set<string> })
    .__snivatUsedResets ??= new Set<string>());

export type ResetClaim = { email: string };

/** Null when invalid, expired, or already consumed. */
export function verifyResetToken(token: string): ResetClaim | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  // Constant-time compare.
  const h = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEq(h(sig), h(expected))) return null;
  try {
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as {
      e?: string;
      x?: number;
      j?: string;
    };
    if (!data.e || typeof data.x !== "number" || !data.j) return null;
    if (Date.now() > data.x) return null;
    if (usedNonces.has(data.j)) return null;
    usedNonces.add(data.j);
    if (usedNonces.size > 5_000) usedNonces.clear(); // bounded
    return { email: data.e };
  } catch {
    return null;
  }
}

function timingSafeEq(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

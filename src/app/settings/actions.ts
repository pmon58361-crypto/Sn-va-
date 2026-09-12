"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidateSessionCache } from "@/lib/session-cache";
import { claimUploads } from "@/lib/uploads";
import dns from "node:dns/promises";

// ── SSRF guard for the avatar probe ──────────────────────────────────────────
// saveSettings fetches a user-supplied URL server-side (content-type check),
// so blindly fetching would let an attacker make OUR server request internal
// targets (cloud metadata, intranet, local services). Refuse anything that
// resolves to a non-public address, re-validating every redirect hop.
function isPrivateIp(addr: string): boolean {
  const l = addr.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — judge by the v4 tail.
  const v4tail = l.includes(".") ? l.slice(l.lastIndexOf(":") + 1) : null;
  const v4 = v4tail ?? (l.includes(":") ? null : l);
  if (v4) {
    const p = v4.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (l === "::1" || l === "::") return true;
  const first = parseInt(l.split(":")[0] || "0", 16);
  if (!Number.isFinite(first)) return true;
  if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  return false;
}

async function assertPublicHttpUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("not-public");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not-public");
  try {
    const addrs = await dns.lookup(url.hostname, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
      throw new Error("not-public");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "not-public") throw err;
    throw new Error("not-public");
  }
}

export type SettingsInput = {
  name: string;
  bio: string;
  location: string;
  image: string;
  theme: string;
  accent: string;
  background: string;
  publicProfile: boolean;
  showEmail: boolean;
  isCreator: boolean;
  notifyMessages: boolean;
  weeklyDigest: boolean;
};

export async function saveSettings(input: SettingsInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const accentOk = /^#[0-9a-fA-F]{6}$/.test(input.accent);
  const bgOk = /^#[0-9a-fA-F]{6}$/.test(input.background ?? "");
  const themeOk = input.theme === "light" || input.theme === "dark";

  // Avatar must be a direct image URL. Search-result pages and other HTML
  // pages silently render as broken <img> tags everywhere, so we verify
  // content-type before accepting it.
  const image = input.image.trim();
  if (image) {
    const isLocal = image.startsWith("/");
    const isDataImg = image.startsWith("data:image/");
    if (!isLocal && !isDataImg && !/^https?:\/\//i.test(image)) {
      throw new Error("Avatar URL must start with https:// (or be a direct image link).");
    }
    if (/^https?:\/\//i.test(image)) {
      try {
        // Manual redirect walk (max 3 hops): fetch() follows redirects
        // blindly, so each hop is re-validated against the SSRF guard —
        // otherwise a public shortlink could bounce the probe at 169.254.
        let current = image;
        let res: Response | null = null;
        for (let hop = 0; hop < 4; hop++) {
          await assertPublicHttpUrl(current);
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 6000);
          try {
            res = await fetch(current, {
              method: "GET",
              headers: { Range: "bytes=0-64" },
              signal: controller.signal,
              redirect: "manual",
            });
          } finally {
            clearTimeout(t);
          }
          const loc =
            res.status >= 300 && res.status < 400
              ? res.headers.get("location")
              : null;
          if (!loc) break;
          current = new URL(loc, current).toString();
          res = null;
          if (hop === 3) throw new Error("too-many-redirects");
        }
        const ct = res?.headers.get("content-type") || "";
        if (!res || !ct.startsWith("image/")) {
          throw new Error();
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Avatar")) throw err;
        throw new Error(
          "That link is not a direct image. Open the picture itself, copy its address (it should end in .jpg/.png/.webp), and paste that."
        );
      }
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      // Server-side length caps (client also limits, but actions are the
      // trust boundary — unbounded strings become UI-busting giant cards).
      name: input.name.trim().slice(0, 60) || null,
      bio: input.bio.trim().slice(0, 500) || null,
      location: input.location.trim().slice(0, 100) || null,
      image: image || null,
    },
  });

  await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: {
      theme: themeOk ? input.theme : "light",
      accent: accentOk ? input.accent : "#e8a33d",
        background: bgOk ? input.background.toUpperCase() : null,
      publicProfile: input.publicProfile,
      showEmail: input.showEmail,
      isCreator: input.isCreator,
      notifyMessages: input.notifyMessages,
      weeklyDigest: input.weeklyDigest,
    },
    create: {
      userId: session.user.id,
      theme: themeOk ? input.theme : "light",
      accent: accentOk ? input.accent : "#e8a33d",
        background: bgOk ? input.background.toUpperCase() : null,
      publicProfile: input.publicProfile,
      showEmail: input.showEmail,
      isCreator: input.isCreator,
      notifyMessages: input.notifyMessages,
      weeklyDigest: input.weeklyDigest,
    },
  });

  // Session cache must never outlive a settings write (instant propagation).
  invalidateSessionCache(session.user.id);

  // Claim the avatar (if it came from our own uploads; pasted remote
  // links match zero rows and are ignored).
  await claimUploads(session.user.id, [image || null], "avatar");

  revalidatePath("/settings");
  revalidatePath("/community");
  revalidatePath("/jobs");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Self-deactivation (reversible): hides the profile and posts everywhere and
 * blocks all writes until the owner signs back in, which clears the flag.
 * The client signs the user out right after this succeeds.
 */
export async function deactivateAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { deactivatedAt: new Date() },
  });
  invalidateSessionCache(session.user.id);

  revalidatePath("/", "layout");
  return { ok: true };
}


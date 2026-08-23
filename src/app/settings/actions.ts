"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidateSessionCache } from "@/lib/session-cache";

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
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(image, {
          method: "GET",
          headers: { Range: "bytes=0-64" },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(t);
        const ct = res.headers.get("content-type") || "";
        if (!ct.startsWith("image/")) {
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
      name: input.name.trim() || null,
      bio: input.bio.trim() || null,
      location: input.location.trim() || null,
      image: image || null,
    },
  });

  await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: {
      theme: themeOk ? input.theme : "light",
      accent: accentOk ? input.accent : "#2f9e6b",
        background: bgOk ? input.background.toUpperCase() : null,
      publicProfile: input.publicProfile,
      showEmail: input.showEmail,
      isCreator: input.isCreator,
    },
    create: {
      userId: session.user.id,
      theme: themeOk ? input.theme : "light",
      accent: accentOk ? input.accent : "#2f9e6b",
        background: bgOk ? input.background.toUpperCase() : null,
      publicProfile: input.publicProfile,
      showEmail: input.showEmail,
      isCreator: input.isCreator,
    },
  });

  // Session cache must never outlive a settings write (instant propagation).
  invalidateSessionCache(session.user.id);

  revalidatePath("/settings");
  revalidatePath("/community");
  revalidatePath("/jobs");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return { ok: true };
}


"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type SettingsInput = {
  name: string;
  bio: string;
  location: string;
  image: string;
  theme: string;
  accent: string;
  background: string;
  emailNotifications: boolean;
  publicProfile: boolean;
  showEmail: boolean;
};

export async function saveSettings(input: SettingsInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const accentOk = /^#[0-9a-fA-F]{6}$/.test(input.accent);
  const bgOk = /^#[0-9a-fA-F]{6}$/.test(input.background ?? "");
  const themeOk = input.theme === "light" || input.theme === "dark";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: input.name.trim() || null,
      bio: input.bio.trim() || null,
      location: input.location.trim() || null,
      image: input.image.trim() || null,
    },
  });

  await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: {
      theme: themeOk ? input.theme : "light",
      accent: accentOk ? input.accent : "#2f9e6b",
        background: bgOk ? input.background.toUpperCase() : null,
      emailNotifications: input.emailNotifications,
      publicProfile: input.publicProfile,
      showEmail: input.showEmail,
    },
    create: {
      userId: session.user.id,
      theme: themeOk ? input.theme : "light",
      accent: accentOk ? input.accent : "#2f9e6b",
        background: bgOk ? input.background.toUpperCase() : null,
      emailNotifications: input.emailNotifications,
      publicProfile: input.publicProfile,
      showEmail: input.showEmail,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/community");
  revalidatePath("/jobs");
  revalidatePath("/applications");
  return { ok: true };
}


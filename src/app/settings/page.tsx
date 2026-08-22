import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./SettingsForm";
import type { SettingsInput } from "./actions";

export const metadata = { title: "Settings — Snívať" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/settings");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { settings: true },
  });

  if (!user) redirect("/auth/signin");

  const s = user.settings;
  const initial: SettingsInput = {
    name: user.name || "",
    bio: user.bio || "",
    location: user.location || "",
    image: user.image || "",
    theme: s?.theme || "light",
    accent: s?.accent || "#2f9e6b",
    background: s?.background ?? "",
    emailNotifications: s?.emailNotifications ?? true,
    publicProfile: s?.publicProfile ?? true,
    showEmail: s?.showEmail ?? false,
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="eyebrow mb-4">Account</p>
      <h1 className="mb-2 display-2 text-ink">Settings</h1>
      <p className="mb-10 text-sm text-ink-muted">
        Manage your profile, appearance, and privacy.
      </p>
      <SettingsForm initial={initial} />
    </div>
  );
}


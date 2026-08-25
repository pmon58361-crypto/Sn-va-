import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { CalendarIcon } from "@/components/ui/Icons";
import { SettingsForm } from "./SettingsForm";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { getTopTags } from "@/lib/queries";
import { parseTags } from "@/lib/utils";
import type { SettingsInput } from "./actions";

export const metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/settings");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      settings: true,
      _count: { select: { posts: true, followers: true } },
    },
  });

  if (!user) redirect("/auth/signin");

  const s = user.settings;
  const initial: SettingsInput = {
    name: user.name || "",
    bio: user.bio || "",
    location: user.location || "",
    image: user.image || "",
    theme: s?.theme || "light",
    accent: s?.accent || "#e8a33d",
    background: s?.background ?? "",
    publicProfile: s?.publicProfile ?? true,
    showEmail: s?.showEmail ?? false,
    isCreator: s?.isCreator ?? false,
  };

  const provider = (session.user.provider as string) || user.provider;
  const [topTags] = await Promise.all([getTopTags(24)]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      {/* Page heading */}
      <p className="eyebrow mb-2">Account</p>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        Manage your profile, appearance, and privacy.
      </p>

      {/* Identity header */}
      <section className="card mb-8 overflow-hidden">
        <div
          className="h-16 w-full"
          style={{
            background: `linear-gradient(120deg, ${initial.accent}30 0%, transparent 50%), var(--bg-elevated)`,
          }}
        />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 mb-4">
            <span className="inline-block rounded-full border-4 border-[var(--bg-elevated)]">
              <Avatar name={user.name} image={user.image} size={88} />
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight text-ink">
                {user.name || "Anonymous"}
              </h2>
              <p className="truncate text-sm text-ink-muted">{user.email}</p>
            </div>
            <span className="badge border border-line bg-[var(--bg-soft)] capitalize text-ink-muted">
              {provider} sign-in
            </span>
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-faint">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Joined{" "}
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </span>
            <span aria-hidden>·</span>
            <span>
              <b className="font-semibold text-ink-soft">{user._count.posts}</b>{" "}
              posts
            </span>
            <span aria-hidden>·</span>
            <span>
              <b className="font-semibold text-ink-soft">
                {user._count.followers}
              </b>{" "}
              followers
            </span>
          </p>
        </div>
      </section>

      <SettingsForm
        initial={initial}
        interests={parseTags(s?.interests)}
        suggestions={topTags.map(([t]) => t)}
      />

      {/* Admin-only — ad management moved here from the Moderation header.
          Hidden for every non-admin session. */}
      {session.user.role === "admin" && (
        <section className="card mt-8 flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-ink">Admin</h2>
            <p className="text-xs text-ink-muted">
              Manage ad campaigns across the site.
            </p>
          </div>
          <Link href="/admin/ads" className="btn-outline shrink-0">
            Manage ads →
          </Link>
        </section>
      )}

      <div className="mt-10 border-t border-line pt-5 text-center">
        <LegalLinks />
      </div>
    </div>
  );
}

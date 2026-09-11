"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  PlusIcon,
  MenuIcon,
  BookIcon,
  CompassIcon,
  ChartIcon,
  SettingsIcon,
  ShieldIcon,
} from "@/components/ui/Icons";

type Tab = {
  href: string;
  label: string;
  icon: typeof HomeIcon | typeof UsersIcon;
  primary?: boolean;
  needsAuth?: boolean;
};

// Destinations that don't fit the five tabs live here — one tap away
// instead of missing entirely on phones.
const MORE_LINKS = [
  { href: "/bookmarks", label: "Bookmarks", icon: BookIcon },
  { href: "/people", label: "People", icon: CompassIcon },
  { href: "/dashboard", label: "Dashboard", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/moderation", label: "Moderation", icon: ShieldIcon },
] as const;

/**
 * Mobile bottom tab bar — Instagram/TikTok pattern.
 * Fixed below the lg breakpoint; desktop keeps the sidebar.
 * Five equal slots so the elevated "New Post" button sits dead-center.
 * (Six slots can't center it — slot 3 of 6 sits left of middle.)
 * Profile moved into the "More" sheet header (and stays on the top-bar
 * avatar) — no destination lost, bar stays symmetric.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { status, data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);

  // Esc closes the sheet.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // A fresh navigation always drops the sheet.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (status === "loading") return null;
  // Guests see the marketing site, not app chrome.
  if (status === "unauthenticated") return null;

  const profileHref =
    status === "authenticated" && session?.user?.id
      ? `/profile/${session.user.id}`
      : "/auth/signin";

  const tabs: Tab[] = [
    { href: "/community", label: "Home", icon: HomeIcon },
    { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
    { href: "/new", label: "New", icon: PlusIcon, primary: true },
    { href: "/applications", label: "Apps", icon: ClipboardIcon },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const moreActive =
    MORE_LINKS.some(({ href }) => isActive(href)) || isActive(profileHref);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map(({ href, label, icon: Icon, primary }) => {
            const active = !primary && isActive(href);
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={primary ? "Create new post" : undefined}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors touch-manipulation ${
                  active ? "text-accent" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {primary ? (
                  <span
                    className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition-transform active:scale-95"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                ) : (
                  <>
                    <Icon className="h-[22px] w-[22px]" />
                    {active && (
                      <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
                    )}
                  </>
                )}
                {primary ? (
                  <span className="sr-only">New post</span>
                ) : (
                  <span>{label}</span>
                )}
              </Link>
            );
          })}
          {/* More — the rest of the sidebar, one tap away. */}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-label="More options"
            className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors touch-manipulation ${
              moreActive && !moreOpen
                ? "text-accent"
                : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            <MenuIcon className="h-[22px] w-[22px]" />
            {(moreActive || moreOpen) && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
            )}
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More options"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            <div className="p-3">
              <Link
                href={profileHref}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-soft"
              >
                <Avatar
                  name={session?.user?.name}
                  image={session?.user?.image}
                  size={40}
                />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-bold text-ink">
                    {session?.user?.name || "Your profile"}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    View profile
                  </span>
                </span>
              </Link>
              <div className="mx-3 my-2 border-t border-line" aria-hidden />
              {MORE_LINKS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation ${
                      active
                        ? "text-accent"
                        : "text-ink-soft hover:bg-soft hover:text-ink"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        active ? "bg-accent-tint" : "bg-soft"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

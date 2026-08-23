"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  PlusIcon,
  UserIcon,
} from "@/components/ui/Icons";

type Tab = {
  href: string;
  label: string;
  icon: typeof HomeIcon | typeof UsersIcon;
  primary?: boolean;
  needsAuth?: boolean;
};

/**
 * Mobile bottom tab bar — Instagram/TikTok pattern.
 * Fixed below the lg breakpoint; desktop keeps the sidebar.
 * Center slot is an elevated "New Post" action button.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { status, data: session } = useSession();

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
    { href: profileHref, label: "You", icon: UserIcon, needsAuth: true },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
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
              className={`relative flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
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
                  <Icon className="h-5 w-5" />
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
                  )}
                </>
              )}
              <span>{primary ? "\u00A0" : label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

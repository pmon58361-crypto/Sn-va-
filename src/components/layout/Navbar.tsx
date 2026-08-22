"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import {
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  CompassIcon,
} from "@/components/ui/Icons";

const NAV = [
  { href: "/community", label: "Community", icon: UsersIcon },
  { href: "/people", label: "People", icon: CompassIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/applications", label: "Applications", icon: ClipboardIcon },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "text-accent bg-accent/10"
                      : "text-ink-muted hover:text-ink hover:bg-line/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "authenticated" ? (
            <>
              <Link href="/people" className="btn-primary hidden sm:inline-flex">
                <CompassIcon className="h-4 w-4" />
                Find people
              </Link>
              {/* Tapping the avatar goes straight to your profile. */}
              <Link
                href={`/profile/${session.user.id}`}
                aria-label="Your profile"
                className="rounded-full ring-2 ring-transparent transition hover:ring-line-strong"
              >
                <Avatar
                  name={session.user.name}
                  image={session.user.image}
                  size={34}
                />
              </Link>
            </>
          ) : status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-line" />
          ) : (
            <Link href="/auth/signin" className="btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import {
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  PlusIcon,
  SettingsIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
  UserIcon,
} from "@/components/ui/Icons";

const NAV = [
  { href: "/community", label: "Community", icon: UsersIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/applications", label: "Applications", icon: ClipboardIcon },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

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
              <Link href="/new" className="btn-primary hidden sm:inline-flex">
                <PlusIcon className="h-4 w-4" />
                New Post
              </Link>
              <div className="relative">
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  className="rounded-full ring-2 ring-transparent transition hover:ring-line-strong"
                  aria-label="Account menu"
                >
                  <Avatar
                    name={session.user.name}
                    image={session.user.image}
                    size={34}
                  />
                </button>
                {userMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenu(false)}
                    />
                    <div
                      className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-2xl border border-line bg-surface p-1.5 reveal"
                      style={{ boxShadow: "var(--shadow-lg)" }}
                    >
                      <div className="px-3 py-2">
                        <p className="truncate text-sm font-medium text-ink">
                          {session.user.name || "Account"}
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {session.user.email}
                        </p>
                      </div>
                      <div className="my-1 h-px bg-line" />
                      <Link
                        href={`/profile/${session.user.id}`}
                        onClick={() => setUserMenu(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line/70"
                      >
                        <UserIcon className="h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserMenu(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line/70"
                      >
                        <SettingsIcon className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line/70"
                      >
                        <LogoutIcon className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-line" />
          ) : (
            <Link href="/auth/signin" className="btn-primary">
              Sign in
            </Link>
          )}

          <button
            className="md:hidden btn-ghost p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-line bg-bg px-5 py-3">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(item.href)
                      ? "text-accent bg-accent/10"
                      : "text-ink-soft hover:bg-line/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {status === "authenticated" && (
              <Link
                href="/new"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-line/60"
              >
                <PlusIcon className="h-4 w-4" />
                New Post
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

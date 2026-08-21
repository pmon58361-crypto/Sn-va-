"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogoMark } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import {
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  SettingsIcon,
  LogoutIcon,
  UserIcon,
  SearchIcon,
  PlusIcon,
  MessageIcon,
  BookIcon,
} from "@/components/ui/Icons";

const NAV = [
  { href: "/community", label: "Community", icon: UsersIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/applications", label: "Applications", icon: ClipboardIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [userMenu, setUserMenu] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  if (status !== "authenticated") return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line px-3 py-5 lg:flex">
      {/* Logo */}
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-3">
        <LogoMark size={32} />
        <span className="text-lg font-bold tracking-tight">
          <span className="text-ink">Sní</span>
          <span className="text-accent">vať</span>
        </span>
      </Link>

      {/* Search */}
      <form action="/community" method="GET" className="mb-4 px-1">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="q"
            placeholder="Search…"
            className="input w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </form>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        <SidebarLink href={`/profile/${session.user.id}`} active={isActive(`/profile/${session.user.id}`)} icon={UserIcon} label="Profile" />
        {NAV.map((item) => (
          <SidebarLink key={item.href} href={item.href} active={isActive(item.href)} icon={item.icon} label={item.label} />
        ))}
        {/* Not-yet-built features — disabled, not faked */}
        <SidebarLink href="/dm" active={isActive("/dm")} icon={MessageIcon} label="DM's" />
        <SidebarLink href="#" icon={BookIcon} label="Bookmarks" disabled active={false} />
        <SidebarLink href="/settings" active={isActive("/settings")} icon={SettingsIcon} label="Settings" />
      </nav>

      <div className="my-4 h-px bg-line" />

      {/* Create button — S symbol only */}
      <Link
        href="/new"
        className="mb-2 flex items-center justify-center rounded-xl py-2.5 text-accent transition hover:bg-accent/10"
        aria-label="Create post"
      >
        <LogoMark size={28} />
      </Link>

      {/* User card at bottom */}
      <div className="mt-auto">
        <div className="relative">
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-line/50"
          >
            <Avatar name={session.user.name} image={session.user.image} size={32} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-ink">
                {session.user.name || "Account"}
              </p>
              <p className="truncate text-xs text-ink-faint">
                {session.user.email}
              </p>
            </div>
          </button>
          {userMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
              <div
                className="absolute bottom-12 left-0 z-20 w-full rounded-xl border border-line bg-surface p-1.5"
                style={{ boxShadow: "var(--shadow-lg)" }}
              >
                <Link href={`/profile/${session.user.id}`} onClick={() => setUserMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line/70">
                  <UserIcon className="h-4 w-4" /> Profile
                </Link>
                <Link href="/settings" onClick={() => setUserMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line/70">
                  <SettingsIcon className="h-4 w-4" /> Settings
                </Link>
                <button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line/70">
                  <LogoutIcon className="h-4 w-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  label,
  disabled = false,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-faint/50" title="Coming soon">
        <Icon className="h-4 w-4" />
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent/10 text-accent"
          : "text-ink-muted hover:text-ink hover:bg-line/50"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}


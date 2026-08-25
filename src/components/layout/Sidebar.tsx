"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogoMark } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import {
  UsersIcon,
  UserIcon,
  BriefcaseIcon,
  ClipboardIcon,
  SettingsIcon,
  SearchIcon,
  MessageIcon,
  BookIcon,
  BellIcon,
  CompassIcon,
  PlusIcon,
  ShieldIcon,
  ChartIcon,
} from "@/components/ui/Icons";
import { NotificationsBadge } from "./NotificationsBadge";

const NAV = [
  { href: "/community", label: "Community", icon: UsersIcon },
  { href: "/people", label: "People", icon: CompassIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/applications", label: "Applications", icon: ClipboardIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  if (status !== "authenticated") return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line px-3 py-5 lg:flex">
      {/* Logo — goes to your home feed */}
      <Link href="/community" aria-label="Home" className="mb-6 flex items-center gap-2.5 px-3">
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
        <SidebarLink
          href="/notifications"
          active={isActive("/notifications")}
          icon={BellIcon}
          label="Notifications"
          badge={<NotificationsBadge />}
        />
        <SidebarLink href="/bookmarks" active={isActive("/bookmarks")} icon={BookIcon} label="Bookmarks" />
        <SidebarLink href="/groups" active={isActive("/groups")} icon={UsersIcon} label="Groups" />
        {session.user.isCreator && (
          <SidebarLink href="/dashboard" active={isActive("/dashboard")} icon={ChartIcon} label="Dashboard" />
        )}
        <SidebarLink href="/settings" active={isActive("/settings")} icon={SettingsIcon} label="Settings" />
        {session.user.role === "admin" && (
          <SidebarLink href="/admin" active={isActive("/admin")} icon={ShieldIcon} label="Moderation" />
        )}
      </nav>

      <div className="my-4 h-px bg-line" />

      {/* Create button — full-width pill */}
      <Link
        href="/new"
        aria-label="Create post"
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-accent-hover"
      >
        <PlusIcon className="h-4 w-4" />
        New post
      </Link>

      {/* User card at bottom — click goes straight to your profile */}
      <div className="mt-auto">
        <Link
          href={`/profile/${session.user.id}`}
          aria-label="Your profile"
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
        </Link>
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
  badge,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  badge?: React.ReactNode;
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
      {badge && <span className="ml-auto">{badge}</span>}
    </Link>
  );
}



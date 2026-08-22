import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo />
          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-ink-muted">
            <Link href="/community" className="transition hover:text-accent">Community</Link>
            <Link href="/jobs" className="transition hover:text-accent">Jobs</Link>
            <Link href="/applications" className="transition hover:text-accent">Applications</Link>
            <Link href="/auth/signin" className="transition hover:text-accent">Sign in</Link>
          </nav>
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} Snívať · Dream. Grow. Connect.
          </p>
        </div>
      </div>
    </footer>
  );
}

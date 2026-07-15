import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand + philosophy */}
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-muted">
              A living network for talent and opportunity. Where careers grow,
              connect, and evolve — together.
            </p>
            <p className="mt-5 eyebrow">Partial DNA</p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Navigation
            </h4>
            <ul className="space-y-3 text-sm text-ink-muted">
              <li><Link href="/community" className="transition hover:text-accent">Community</Link></li>
              <li><Link href="/jobs" className="transition hover:text-accent">Jobs</Link></li>
              <li><Link href="/applications" className="transition hover:text-accent">Applications</Link></li>
              <li><Link href="/settings" className="transition hover:text-accent">Settings</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Account
            </h4>
            <ul className="space-y-3 text-sm text-ink-muted">
              <li><Link href="/auth/signin" className="transition hover:text-accent">Sign in</Link></li>
              <li><Link href="/new" className="transition hover:text-accent">Create a post</Link></li>
              <li><Link href="/settings" className="transition hover:text-accent">Profile &amp; settings</Link></li>
            </ul>
          </div>

          {/* About / philosophy */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
              About
            </h4>
            <p className="text-sm leading-relaxed text-ink-muted">
              Every connection is a strand. Every person, a sequence. We grow
              when knowledge flows between us.
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-line pt-8 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} Snívať · Crafted with the Partial DNA design language
        </div>
      </div>
    </footer>
  );
}

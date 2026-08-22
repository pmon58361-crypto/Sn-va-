import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { getPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// THE FRONT — quiet premium.
// Black canvas · one living aurora in brand tones · typography does the work.
// Real numbers, real posts, honest empty states. Zero client JS.
// ─────────────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/community", label: "Community" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
];

export async function Landing() {
  // Best-effort DB reads — a cold Neon should never blank the page.
  let posts: Awaited<ReturnType<typeof getPosts>> = [];
  let users = 0;
  let postCount = 0;
  try {
    posts = await getPosts({ category: "COMMUNITY", limit: 3 });
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
    ]);
    users = counts[0];
    postCount = counts[1];
  } catch {
    /* render with defaults */
  }

  return (
    <div className="relative min-h-screen bg-[#050507] text-white">
      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b hairline bg-[#050507]/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="hidden items-center gap-8 text-sm font-medium text-white/55 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition hover:text-white">
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signin"
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/90"
            >
              Start growing
            </Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-16">
        {/* the one animated element on the page */}
        <div aria-hidden className="aurora">
          <span className="aurora-blob aurora-a" />
          <span className="aurora-blob aurora-b" />
          <span className="aurora-blob aurora-c" />
          <span className="aurora-streaks" />
        </div>

        <p className="rise-in relative z-10 inline-flex items-center gap-2.5 rounded-full border border-emerald-300/25 bg-emerald-400/[0.06] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Dream · Grow · Connect
        </p>

        <h1 className="rise-in relative z-10 mt-8 max-w-4xl select-none text-center text-[13vw] font-black leading-[0.95] tracking-[-0.035em] sm:text-[9vw] lg:text-[6.75rem]" style={{ animationDelay: "120ms" }}>
          Build in public.
          <br />
          <span className="display-serif grad-ink lowercase italic tracking-normal">
            dream out loud.
          </span>
        </h1>

        <p className="rise-in relative z-10 mx-auto mt-8 max-w-lg text-center text-base leading-relaxed text-white/55 sm:text-lg" style={{ animationDelay: "260ms" }}>
          Snívať is where people share progress while it&apos;s still becoming —
          the wins, the failures, the proof. Not LinkedIn. Not noise.
        </p>

        <div className="rise-in relative z-10 mt-10 flex flex-col items-center gap-3 sm:flex-row" style={{ animationDelay: "380ms" }}>
          <Link
            href="/auth/signin"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-9 py-4 text-base font-bold text-black shadow-[0_0_60px_-12px_rgba(52,211,153,0.45)] transition hover:bg-white/90"
          >
            Start growing — it&apos;s free
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/community"
            className="rounded-full border border-white/15 px-9 py-4 text-base font-semibold text-white/80 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
          >
            Watch the feed
          </Link>
        </div>

        {/* live stats — real numbers or nothing */}
        <div className="rise-in relative z-10 mt-14 flex items-center gap-8 sm:gap-12" style={{ animationDelay: "500ms" }}>
          {[
            { n: users, l: "builders" },
            { n: postCount, l: "posts of proof" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-3xl font-black tabular-nums text-white">{s.n}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/35">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVING PROOF — real posts ────────────────────────────────── */}
      <section className="relative border-t hairline px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Living proof</p>
              <h2 className="mt-3 display-serif text-4xl sm:text-5xl">
                Real people. <em>Real work.</em>
              </h2>
            </div>
            <Link href="/community" className="hidden shrink-0 text-sm font-semibold text-white/50 transition hover:text-white sm:block">
              Open the feed →
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-14 text-center text-white/45">
              Nothing here yet. The first post could be yours.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[0.05]"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <Avatar name={p.author?.name} image={p.author?.image} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.author?.name || "Someone"}</p>
                      <p className="text-xs text-white/40">{timeAgo(p.createdAt)}</p>
                    </div>
                    <span aria-hidden className="ml-auto text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-emerald-300">↗</span>
                  </div>
                  <h3 className="font-bold leading-snug">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/50">{p.content}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── THREE ROOMS ──────────────────────────────────────────────── */}
      <section className="border-t hairline px-5 py-24">
        <div className="mx-auto max-w-6xl">
          {[
            { n: "01", href: "/community", t: "Community", d: "Show your work while it's still becoming. Someone a step behind you needs to see it." },
            { n: "02", href: "/jobs", t: "Jobs", d: "Offer what you do, or find who does it. No middle layer between you and the work." },
            { n: "03", href: "/applications", t: "Applications", d: "Open positions, applied to in one breath. Friction removed." },
          ].map((row) => (
            <Link
              key={row.n}
              href={row.href}
              className="group flex flex-col gap-3 border-t hairline py-10 transition-colors last:border-b hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-10 sm:py-12"
            >
              <span className="display-serif shrink-0 text-4xl italic text-white/20 transition-colors duration-500 group-hover:text-emerald-300/70 sm:w-24 sm:text-6xl">
                {row.n}
              </span>
              <div className="flex-1">
                <h2 className="display-serif text-3xl transition-colors duration-300 group-hover:text-emerald-300 sm:text-5xl">{row.t}</h2>
                <p className="mt-2 max-w-md leading-relaxed text-white/45">{row.d}</p>
              </div>
              <span aria-hidden className="shrink-0 text-2xl text-white/15 transition-all duration-500 group-hover:translate-x-2 group-hover:text-emerald-300">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t hairline px-5 py-32 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 60% at 50% 115%, rgba(47,158,107,0.22), transparent 70%)",
          }}
        />
        <h2 className="display-serif relative z-10 text-5xl leading-[1.02] sm:text-7xl">
          Your story<br />
          <em className="grad-ink">starts now.</em>
        </h2>
        <Link
          href="/auth/signin"
          className="group relative z-10 mt-10 inline-flex items-center gap-3 rounded-full bg-white px-10 py-4.5 text-lg font-bold text-black transition hover:bg-white/90"
          style={{ paddingTop: "1.1rem", paddingBottom: "1.1rem" }}
        >
          Join Snívať
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-black text-white transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
        <p className="relative z-10 mt-6 text-xs uppercase tracking-[0.3em] text-white/30">
          Seconds to sign in · A lifetime of proof ahead
        </p>
      </section>

    </div>
  );
}
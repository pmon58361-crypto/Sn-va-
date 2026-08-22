import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { getPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import { ScrollProgress, Reveal, TiltCard } from "@/components/landing/Fx";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// THE FRONT. A piece, not a page.
// Dark canvas Â· brass light Â· kinetic serif Â· DNA strands Â· real posts.
// Pure CSS motion â€” zero client JS, every CTA a plain Link.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")";

export async function Landing() {
  // DB reads are best-effort: if Postgres is unreachable (Neon cold start),
  // render the page with an empty state instead of a 500.
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
    // keep defaults
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#070708] text-white">
      <ScrollProgress />
      {/* film grain over everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {/* â”€â”€ NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#070708]/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="hidden items-center gap-8 text-sm font-medium text-white/55 md:flex">
            <Link href="/community" className="transition hover:text-white">Community</Link>
            <Link href="/jobs" className="transition hover:text-white">Jobs</Link>
            <Link href="/applications" className="transition hover:text-white">Listings</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/signin" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white sm:block">
              Sign in
            </Link>
            <Link href="/auth/signin" className="rounded-full bg-[#c9a24b] px-5 py-2 text-sm font-bold text-black transition hover:brightness-110">
              Start growing
            </Link>
          </div>
        </nav>
      </header>

      {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-24">
        {/* Raycast-style animated aurora field */}
        <div aria-hidden className="aurora">
          <span className="aurora-blob aurora-a" />
          <span className="aurora-blob aurora-b" />
          <span className="aurora-blob aurora-c" />
          <span className="aurora-streaks" />
        </div>

        <div className="relative z-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c9a24b]/40 bg-[#c9a24b]/[0.07] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-[#c9a24b]">
            Est. by the ones who build
          </span>
        </div>

        <h1 className="relative z-10 mt-10 select-none text-center leading-[0.88]">
          <span className="block text-[17vw] font-black uppercase tracking-[-0.04em] sm:text-[13vw] lg:text-[9.5rem]" style={{ animationDelay: "80ms" }}>
            Build in
          </span>
          <span className="block text-[17vw] font-black uppercase tracking-[-0.04em] sm:text-[13vw] lg:text-[9.5rem]" style={{ animationDelay: "180ms" }}>
            the <span className="display-serif lowercase italic tracking-normal text-[#c9a24b]">open.</span>
          </span>
        </h1>

        <p className="relative z-10 mx-auto mt-9 max-w-md text-center text-base leading-relaxed text-white/55 sm:text-lg" style={{ animationDelay: "320ms" }}>
          Progress, wins and failures â€” shared as they happen.
          Your work becomes proof. Your proof becomes opportunity.
        </p>

        <div className="relative z-10 mt-11 flex flex-col items-center gap-3 sm:flex-row" style={{ animationDelay: "440ms" }}>
          <Link href="/auth/signin" className="group inline-flex items-center gap-2 rounded-full bg-[#c9a24b] px-10 py-4 text-base font-bold text-black transition hover:brightness-110">
            Start growing â€” it's free
            <span className="transition-transform duration-300 group-hover:translate-x-1">â†’</span>
          </Link>
          <Link href="/community" className="rounded-full border border-white/20 px-10 py-4 text-base font-semibold text-white/85 backdrop-blur-sm transition hover:border-white/60 hover:bg-white/5">
            Watch the feed
          </Link>
        </div>

        <div aria-hidden className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-white/25">
          scroll
        </div>

        {/* live stats strip â€” real numbers only */}
        <div className="reveal absolute bottom-8 right-6 hidden items-center gap-6 text-right sm:flex lg:right-20">
          <div>
            <p className="text-2xl font-black tabular-nums text-[#c9a24b]">{users}</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">builders</p>
          </div>
          <span className="h-8 w-px bg-white/15" />
          <div>
            <p className="text-2xl font-black tabular-nums text-[#c9a24b]">{postCount}</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">posts of proof</p>
          </div>
        </div>
      </section>

      {/* â”€â”€ MARQUEE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative overflow-hidden border-y border-white/[0.08] bg-white/[0.02] py-6">
        <div className="animate-marquee flex w-max items-center gap-10 whitespace-nowrap px-5">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-10" aria-hidden={copy === 1}>
              {["Dream", "Grow", "Connect", "Build", "Share", "Rise"].map((w, i) => (
                <span key={`${copy}-${i}`} className="flex items-center gap-10">
                  <span className={`text-5xl font-black uppercase tracking-tight sm:text-7xl ${i % 2 ? "text-outline-gold" : "text-white/90"}`}>
                    {w}
                  </span>
                  <span className="text-2xl text-[#c9a24b]">âœ¦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* reversed echo band */}
      <div className="relative overflow-hidden border-b border-white/[0.08] py-3">
        <div
          className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap px-5"
          style={{ animationDirection: "reverse", animationDuration: "38s" }}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-8" aria-hidden={copy === 1}>
              {["No noise", "No gurus", "Just proof", "Post it", "Own it", "Grow"].map((w, i) => (
                <span key={`${copy}-${i}`} className="flex items-center gap-8 text-sm font-semibold uppercase tracking-[0.35em] text-white/30">
                  {w}
                  <span className="text-[10px] text-[#c9a24b]/60">âœ¦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ DOORS â€” editorial index â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative px-5 py-32">
        <p className="mb-16 text-center text-[11px] font-bold uppercase tracking-[0.35em] text-white/35">
          Three ways in
        </p>
        {[
          { n: "01", href: "/community", t: "Community", d: "Show your work while it's still becoming. Someone a step behind you needs to see it." },
          { n: "02", href: "/jobs", t: "Jobs", d: "Offer what you do or find who does it. No middle layer between you and the work." },
          { n: "03", href: "/applications", t: "Applications", d: "Open positions, applied to in one breath. Friction removed." },
        ].map((row, i) => (
          <Reveal key={row.n} delay={i * 80}>
            <Link
              href={row.href}
              className="group relative mx-auto flex max-w-4xl flex-col gap-4 border-t border-white/10 py-12 transition-colors last:border-b hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-10 sm:py-16"
            >
              <span className="text-outline-white display-serif shrink-0 text-6xl italic transition-all duration-500 group-hover:text-[#c9a24b]/30 sm:w-40 sm:text-8xl">
                {row.n}
              </span>
              <div className="flex-1">
                <h2 className="display-serif text-4xl transition-colors duration-300 group-hover:text-[#c9a24b] sm:text-6xl">
                  {row.t}
                </h2>
                <p className="mt-3 max-w-md leading-relaxed text-white/50">{row.d}</p>
              </div>
              <span className="shrink-0 text-3xl text-white/20 transition-all duration-500 group-hover:translate-x-3 group-hover:text-[#c9a24b]">
                â†’
              </span>
            </Link>
          </Reveal>
        ))}
      </section>

      {/* â”€â”€ LIVING PROOF â€” floating real posts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative overflow-hidden px-5 pb-36 pt-10">
        <span aria-hidden className="text-outline-white pointer-events-none absolute left-1/2 top-1/2 -z-0 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[22vw] font-black uppercase leading-none opacity-[0.07]">
          SnÃ­vaÅ¥
        </span>

        <div className="relative z-10 mb-16 text-center">
          <p className="eyebrow mb-4 !text-[#c9a24b]">Living proof</p>
          <h2 className="display-serif text-4xl sm:text-6xl">
            Real people. <em>Real work.</em>
          </h2>
        </div>

        {posts.length === 0 ? (
          <div className="relative z-10 mx-auto max-w-xl rounded-3xl border border-dashed border-white/15 p-14 text-center text-white/50">
            The canvas is empty. The first stroke could be yours.
          </div>
        ) : (
          <div className="relative z-10 mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={i * 120}>
                <TiltCard
                  className="group h-full rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-md transition-colors duration-300 hover:border-[#c9a24b]/50"
                  max={9}
                >
                  <Link href={`/community/${p.id}`} className="block">
                    <div className="mb-4 flex items-center gap-3">
                      <Avatar name={p.author?.name} image={p.author?.image} size={40} />
                      <div>
                        <p className="text-sm font-bold">{p.author?.name || "Someone"}</p>
                        <p className="text-xs text-white/40">{timeAgo(p.createdAt)}</p>
                      </div>
                      <span className="ml-auto text-[#c9a24b] opacity-0 transition-opacity duration-300 group-hover:opacity-100">â†—</span>
                    </div>
                    <h3 className="text-lg font-bold leading-snug">{p.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/50">{p.content}</p>
                  </Link>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* â”€â”€ MANIFESTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-36 text-center">
        {["Every person changes.", "Every skill connects.", "Every post becomes proof."].map((line, i) => (
          <Reveal key={line} delay={i * 140} className="mx-auto max-w-3xl">
            <p className={i === 2 ? "display-serif mt-2 text-5xl italic text-[#c9a24b] sm:text-7xl" : "text-3xl font-light tracking-wide text-white/45 sm:text-5xl"}>
              {line}
            </p>
          </Reveal>
        ))}
      </section>

      {/* â”€â”€ FINAL CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative overflow-hidden px-5 py-40 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 45% at 50% 100%, rgba(201,162,75,0.18), transparent 70%)",
          }}
        />
        <h2 className="display-serif relative z-10 text-6xl leading-[0.95] sm:text-8xl">
          Your story<br />
          <em className="text-[#c9a24b]">starts now.</em>
        </h2>
        <Link
          href="/auth/signin"
          className="group relative z-10 mt-12 inline-flex items-center gap-3 rounded-full bg-white px-12 py-5 text-lg font-bold text-black transition hover:brightness-95"
        >
          Join SnÃ­vaÅ¥
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black text-white transition-transform duration-300 group-hover:translate-x-1">â†’</span>
        </Link>
        <p className="relative z-10 mt-6 text-xs uppercase tracking-[0.3em] text-white/30">
          Seconds to sign in Â· A lifetime of proof ahead
        </p>
      </section>

      {/* â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="border-t border-white/[0.06] px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-white/35 sm:flex-row">
          <Logo size={26} />
          <p>Dream Â· Grow Â· Connect</p>
          <p>Â© {new Date().getFullYear()} SnÃ­vaÅ¥</p>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { getPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { DriftWall } from "@/components/landing/DriftWall";
import { SpecularButton } from "@/components/landing/SpecularButton";
import { SplitFlapText } from "@/components/landing/SplitFlapText";
import { LiveTicker, type TickerItem } from "@/components/landing/LiveTicker";

// ─────────────────────────────────────────────────────────────────────────
// THE FRONT — builder terminal.
// Hairline grid · monospace metadata · live activity log from the real DB.
// Brass/gold identity. The product is the decoration. Zero client JS.
// ─────────────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/community", label: "/community" },
  { href: "/jobs", label: "/jobs" },
  { href: "/applications", label: "/applications" },
];

// Single conversion entry — every sign-up CTA routes through this constant.
// ?mode=create opens the registration tab (SignInForm reads it).
const AUTH_ENTRY = "/auth/signin?mode=create";

function catVerb(category: string) {
  switch (category) {
    case "JOB_LISTING": return "opened a role";
    case "JOB_OFFER": return "offered work";
    case "JOB_REQUEST": return "is looking for";
    default: return "posted";
  }
}

function catHref(category: string, id: string) {
  return category === "COMMUNITY" ? `/community/${id}` : `/jobs/${id}`;
}

function utcHM(d: Date | string) {
  const t = new Date(d);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

export async function Landing() {
  // Best-effort DB reads — a cold Neon must never blank the page.
  let posts: Awaited<ReturnType<typeof getPosts>> = [];
  let users = 0;
  let postCount = 0;
  let wallItems: { image: string; title: string; href: string }[] = [];
  let joins: { id: string; name: string | null; createdAt: Date }[] = [];
  try {
    posts = await getPosts({ limit: 8, sort: "new" as never });
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, name: true, createdAt: true },
      }),
    ]);
    users = counts[0];
    postCount = counts[1];
    joins = counts[2];

    // Real community imagery for the DriftWall hero background.
    const withImages = await prisma.post.findMany({
      where: { hidden: false, images: { some: {} } },
      select: {
        id: true,
        title: true,
        category: true,
        createdAt: true,
        images: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 14,
    });
    wallItems = withImages
      .filter((p) => p.images[0]?.url)
      .map((p) => ({
        image: p.images[0].url,
        title: p.title,
        href:
          p.category === "COMMUNITY"
            ? `/community/${p.id}`
            : `/jobs/${p.id}`,
      }));
  } catch {
    /* render with defaults */
  }

  const proof = posts.slice(0, 3);

  // Live ticker feed: real recent posts + real recent joins, newest first.
  // Zero synthetic entries — an empty DB simply renders the waiting state.
  const tickerItems: TickerItem[] = [
    ...posts.slice(0, 6).map((p) => ({
      id: p.id,
      kind: "post" as const,
      time: utcHM(p.createdAt),
      name: p.author?.name || "someone",
      verb: catVerb(p.category),
      title: p.title,
      href: catHref(p.category, p.id),
      at: new Date(p.createdAt).getTime(),
    })),
    ...joins.map((u) => ({
      id: `join-${u.id}`,
      kind: "join" as const,
      time: utcHM(u.createdAt),
      name: u.name || "someone",
      at: new Date(u.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)
    .map(({ at: _at, ...item }) => item);

  return (
    <>
      {/* Force the document background to match the landing canvas so the
          area outside the app-shell column is perfectly seamless. */}
      <style dangerouslySetInnerHTML={{ __html: "body{background:#0a0a0b!important}" }} />

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#0a0a0b]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-300 sm:flex">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              live
            </span>
          </div>
          <div className="hidden items-center gap-7 font-mono text-[13px] text-white/50 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition hover:text-white">
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={AUTH_ENTRY}
              className="hidden rounded-full px-4 py-2 font-mono text-[13px] text-white/70 transition hover:bg-white/10 hover:text-white sm:block"
            >
              sign in
            </Link>
            <Link
              href={AUTH_ENTRY}
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/90"
            >
              Start growing
            </Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16">
        {/* Drifting 3D wall of real community imagery — the launch shot */}
        <DriftWall
          items={wallItems}
          columns={8}
          tileWidth={200}
          tileHeight={140}
          gap={16}
          tilt={6}
          turn={10}
          perspective={1300}
          depth={700}
          speed={26}
          direction="up"
          variance={0.4}
          parallax={0.7}
          lift={26}
          fade={0.6}
          dim={0.5}
          overlayColor="rgba(10,10,11,0.74)"
          radius={14}
          roll={2.5}
          pauseOnHover
        />

        {/* hairline grid backdrop */}
        <div aria-hidden className="term-grid pointer-events-none absolute inset-0 abs-bleed" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 abs-bleed"
          style={{ background: "radial-gradient(ellipse 70% 55% at 30% 40%, transparent 30%, #0a0a0b 78%)" }}
        />

        {/* animated signal waves — four layered drifts */}
        <div aria-hidden className="wave-band abs-bleed z-0">
          <svg className="wave-2" viewBox="0 0 2880 200" preserveAspectRatio="none">
            <path d="M0,120 C240,60 480,170 720,105 C960,45 1200,175 1440,115 C1680,55 1920,170 2160,105 C2400,45 2640,175 2880,115 L2880,200 L0,200 Z" fill="rgba(201,162,75,0.15)" />
          </svg>
          <svg className="wave-3" viewBox="0 0 2880 200" preserveAspectRatio="none">
            <path d="M0,70 C240,130 480,25 720,85 C960,140 1200,30 1440,90 C1680,145 1920,35 2160,95 C2400,150 2640,30 2880,80 L2880,200 L0,200 Z" fill="rgba(245,158,11,0.13)" />
          </svg>
          <svg className="wave-1" viewBox="0 0 2880 200" preserveAspectRatio="none">
            <path d="M0,96 C240,160 480,32 720,96 C960,160 1200,32 1440,96 C1680,160 1920,32 2160,96 C2400,160 2640,32 2880,96 L2880,200 L0,200 Z" fill="rgba(251,191,36,0.12)" />
          </svg>
          <svg className="wave-4" viewBox="0 0 2880 200" preserveAspectRatio="none">
            <path d="M0,140 C240,100 480,155 720,125 C960,90 1200,150 1440,135 C1680,95 1920,155 2160,130 C2400,95 2640,150 2880,140 L2880,200 L0,200 Z" fill="rgba(252,211,77,0.10)" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl min-w-0 w-full items-center gap-14 px-5 pb-14 pt-12 sm:pb-20 sm:pt-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.05fr_460px] lg:py-0">
          {/* copy */}
          <div>
            <p className="font-mono text-xs text-white/40">
              <span className="text-amber-300">$</span> snívať --status
            </p>
            <p className="mt-2 font-mono text-xs text-white/55">
              community: online · stories: live · jobs: open
            </p>

            <h1 className="mt-8 select-none text-5xl font-black leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
              Build in public.
              <br />
              <span className="font-mono text-[0.62em] font-bold tracking-tight text-amber-300">
                dream_out_loud
                <span aria-hidden className="cursor-blink">▌</span>
              </span>
            </h1>

            <p className="mt-7 max-w-md text-base leading-relaxed text-white/55 sm:text-lg">
              Progress, wins and failures — logged as they happen. Your work
              becomes proof; your proof becomes opportunity.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/40">
              Concretely: a community feed where builders post what they&apos;re
              making, plus an open job board — hire or get hired without the
              résumé theater.
            </p>

            <div className="mt-9">
              <SplitFlapText
                words={["SNÍVAŤ", "LAUNCH READY", "YOUR FEED"]}
                padTo={12}
                loop
                tileColor="#241b03"
                textColor="#fcd34d"
              />
            </div>
            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row">
              <SpecularButton href={AUTH_ENTRY} className="w-full sm:w-auto">
                Start growing — it&apos;s free
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </SpecularButton>
              <Link
                href="/community"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 font-mono text-sm text-white/75 transition hover:border-white/40 hover:text-white"
              >
                tail -f the feed
              </Link>
            </div>

            <p className="mt-8 font-mono text-xs text-white/35">
              builders: <span className="text-white/80">{users}</span> · posts of proof:{" "}
              <span className="text-white/80">{postCount}</span>
            </p>
          </div>

          {/* terminal panel */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/70 shadow-[0_0_80px_-20px_rgba(245,158,11,0.22)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              </span>
              <span className="font-mono text-xs text-white/40">tail -f community.log</span>
              <span className="w-10" />
            </div>
            <div className="space-y-3 px-4 py-4 font-mono text-[13px] leading-relaxed">
              {tickerItems.length === 0 ? (
                <p className="text-white/35">// waiting for the first entry…</p>
              ) : (
                <LiveTicker items={tickerItems} />
              )}
              <p className="text-white/40">
                <span className="text-amber-300">$</span>{" "}
                <span aria-hidden className="cursor-blink">▌</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVING PROOF ─────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.07] px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300/80">
                ./living-proof
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Real people. Real work.
              </h2>
            </div>
            <Link href="/community" className="font-mono text-sm text-white/45 transition hover:text-white">
              open /community →
            </Link>
          </div>

          {proof.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-14 text-center font-mono text-sm text-white/40">
              // no entries yet — be the first commit
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {proof.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  className="group flex h-full flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/40 hover:bg-white/[0.05]"
                >
                  <p className="mb-4 flex items-center gap-2 font-mono text-xs text-white/40">
                    <span className="text-amber-300/80">{String(i + 1).padStart(2, "0")}</span>
                    <span>@{p.author?.name || "someone"}</span>
                    <span className="ml-auto">{timeAgo(p.createdAt)}</span>
                  </p>
                  <h3 className="font-bold leading-snug">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-white/50">{p.content}</p>
                  <span className="mt-4 font-mono text-xs text-white/30 transition-colors group-hover:text-amber-300">
                    read more →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ROOMS ────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.07] px-5 py-24">
        <div className="mx-auto max-w-6xl">
          {[
            { n: "01", href: "/community", d: "Show your work while it's still becoming. Someone a step behind you needs to see it." },
            { n: "02", href: "/jobs", d: "Offer what you do, or find who does it. No middle layer between you and the work." },
            { n: "03", href: "/applications", d: "Open positions, applied to in one breath. Friction removed." },
          ].map((row) => (
            <Link
              key={row.n}
              href={row.href}
              className="group flex flex-col gap-3 border-t border-white/[0.07] py-10 transition-colors last:border-b hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-10"
            >
              <span className="shrink-0 font-mono text-sm text-white/25 transition-colors group-hover:text-amber-300 sm:w-16">
                {row.n}
              </span>
              <div className="flex-1">
                <h2 className="font-mono text-2xl font-bold text-white/90 transition-colors group-hover:text-amber-300 sm:text-3xl">
                  ~/{row.href.replace("/", "")}
                </h2>
                <p className="mt-2 max-w-md leading-relaxed text-white/45">{row.d}</p>
              </div>
              <span aria-hidden className="shrink-0 font-mono text-xl text-white/15 transition-all duration-500 group-hover:translate-x-2 group-hover:text-amber-300">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.07] px-5 py-32 text-center">
        <div aria-hidden className="term-grid pointer-events-none absolute inset-0 abs-bleed opacity-60" />
        <div className="relative z-10">
          <p className="font-mono text-xs text-white/40">
            <span className="text-amber-300">$</span> git commit -m &quot;my story starts now&quot;
          </p>
          <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
            Every post becomes proof.
          </h2>
          <Link
            href={AUTH_ENTRY}
            className="group mt-10 inline-flex items-center gap-3 rounded-full bg-white px-10 py-4 text-lg font-bold text-black transition hover:bg-white/90"
          >
            Join Snívať
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-black font-mono text-white transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
          {users > 0 && (
            <p className="mt-6 font-mono text-xs text-white/35">
              builders: <span className="text-white/80">{users}</span> · posts of proof:{" "}
              <span className="text-white/80">{postCount}</span> · your turn is next
            </p>
          )}
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-white/30">
            seconds to sign in · a lifetime of proof ahead
          </p>
        </div>
      </section>
    </>
  );
}

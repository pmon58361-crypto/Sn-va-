import Link from "next/link";
import {
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  CompassIcon,
  BookIcon,
  HandshakeIcon,
} from "@/components/ui/Icons";
import { getPosts } from "@/lib/queries";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import { ClockLive } from "@/components/ClockLive";

// Landing page content. Rendered by src/app/page.tsx when the visitor is signed out.
// Premium editorial rebrand — serif display, generous space, real feed preview.

const CURRENTS = [
  {
    href: "/community",
    eyebrow: "Community",
    title: "Grow with people.",
    description:
      "Share what you learn. Find others on the same path. Quiet wins, honest advice, real momentum.",
    icon: UsersIcon,
  },
  {
    href: "/jobs",
    eyebrow: "Jobs",
    title: "Create opportunities.",
    description:
      "Offer what you do, or find someone who does it. Direct, human, no middle layer between you and the work.",
    icon: BriefcaseIcon,
  },
  {
    href: "/applications",
    eyebrow: "Applications",
    title: "Take the next step.",
    description:
      "Open positions, applied to in one breath. The friction between you and what's next — removed.",
    icon: ClipboardIcon,
  },
];

const PRINCIPLES = [
  {
    k: "Growth",
    v: "Growth is shared, not solo. Show your work, your progress, your dead ends — someone a step behind you needs to see it.",
  },
  {
    k: "Connection",
    v: "Real connection comes from real interaction — replies, feedback, collaboration. Not one-click networking.",
  },
  {
    k: "Evolution",
    v: "Your profile is not a résumé. It's a living record of what you've built and how far you've come.",
  },
];

const GROW = [
  { Icon: CompassIcon, title: "Find opportunities.", desc: "Work that fits where you are now — and where you're growing." },
  { Icon: BookIcon, title: "Learn from people.", desc: "Real stories from people a few steps ahead of you." },
  { Icon: HandshakeIcon, title: "Build together.", desc: "Connect, collaborate, and let the next strand form." },
];

export async function Landing() {
  const posts = await getPosts({ category: "COMMUNITY", limit: 3 });

  return (
    <div>
      {/* ════════════════════════ HERO ════════════════════════ */}
<section className="relative">
        {/* Fullscreen pocket-watch � the page IS the clock */}
        <ClockLive fullscreen>
          <div
            className="reveal mb-6 flex justify-center"
            style={{ animationDelay: "0ms" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-1.5 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
              Dream � Grow � Connect
            </span>
          </div>

          <h1
            className="display-serif reveal text-balance text-5xl leading-[1.05] sm:text-6xl md:text-7xl"
            style={{ animationDelay: "100ms", textShadow: "0 2px 24px rgba(0,0,0,.8)" }}
          >
            Grow in public.
            <br />
            Find your <em>people.</em>
          </h1>

          <p
            className="reveal mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
            style={{ animationDelay: "220ms", textShadow: "0 1px 12px rgba(0,0,0,.9)" }}
          >
            Build in the open � sharing progress, wins, and failures as they
            happen. Not LinkedIn. Not a job board. Just people growing together.
          </p>

          <div
            className="reveal mt-8 flex flex-col items-center justify-center gap-3 pb-4 sm:flex-row"
            style={{ animationDelay: "340ms" }}
          >
            <Link href="/auth/signin" className="btn-primary px-9 py-3.5 text-base">
              Start growing
            </Link>
            <Link
              href="/community"
              className="btn-outline border-white/30 px-9 py-3.5 text-base !text-white hover:!border-accent"
            >
              Explore the community
            </Link>
          </div>
        </ClockLive>
      </section>

      {/* ════════════════════════ THREE DOORS ════════════════════════ */}
      <section className="px-5 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-2xl">
            <p className="eyebrow mb-4">Three ways in</p>
            <h2 className="display-serif text-4xl sm:text-5xl">
              One community. <em>Three doors.</em>
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {CURRENTS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="card card-hover group flex flex-col p-9 reveal"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="mb-7 grid h-12 w-12 place-items-center rounded-xl bg-accent-tint text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-ink">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="eyebrow mb-2.5">{s.eyebrow}</p>
                  <h3 className="text-xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                    {s.description}
                  </p>
                  <span className="mt-auto pt-7 text-sm font-semibold text-accent">
                    Enter →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════ PHILOSOPHY ════════════════════════ */}
      <section className="px-5 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-5 justify-center">Partial DNA</p>
          <h2 className="display-serif text-4xl leading-tight sm:text-5xl">
            Every person changes.
            <br />
            Every skill connects.
            <br />
            <em>Every post becomes proof.</em>
          </h2>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.k} className="bg-surface p-9">
              <p className="eyebrow mb-3.5">{p.k}</p>
              <p className="text-[15px] leading-relaxed text-ink-muted">{p.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════ GROW ════════════════════════ */}
      <section className="px-5 pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="eyebrow mb-4 justify-center">Grow</p>
            <h2 className="display-serif text-4xl sm:text-5xl">
              Three things happen here.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {GROW.map((g, i) => {
              const G = g.Icon;
              return (
                <div
                  key={g.title}
                  className="card p-9 text-center reveal"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-accent-tint text-accent">
                    <G className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">{g.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                    {g.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════ LIVE FEED PREVIEW ════════════════════════ */}
      <section className="px-5 pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow mb-3">From the community</p>
              <h2 className="display-serif text-4xl sm:text-5xl">
                Quiet wins, shared.
              </h2>
            </div>
            <Link href="/community" className="btn-outline px-6 py-2.5 text-sm">
              See all →
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="card p-12 text-center text-ink-muted">
              Nothing shared yet. The first story could be yours.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {posts.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  className="card card-hover flex flex-col p-7 reveal"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <Avatar name={p.author?.name} image={p.author?.image} size={38} />
                    <div>
                      <p className="text-sm font-semibold">{p.author?.name || "Someone"}</p>
                      <p className="text-xs text-ink-faint">{timeAgo(p.createdAt)}</p>
                    </div>
                  </div>
                  <h3 className="font-bold leading-snug">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                    {p.content}
                  </p>
                  <span className="mt-auto pt-5 text-xs text-ink-faint">
                    {p._count.comments}{" "}
                    {p._count.comments === 1 ? "comment" : "comments"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════ CTA ════════════════════════ */}
      <section className="px-5 pb-36">
        <div className="mx-auto max-w-3xl">
          <div
            className="card relative overflow-hidden p-14 text-center sm:p-20"
            style={{ boxShadow: "var(--shadow-xl)" }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)",
                backgroundSize: "30px 30px",
              }}
            />
            <h2 className="display-serif relative text-4xl sm:text-5xl">
              Your growth story
              <br />
              <em>starts here.</em>
            </h2>
            <p className="lead relative mx-auto mt-5 max-w-md text-ink-muted">
              Sign in takes seconds. Post your first win from there.
            </p>
            <Link
              href="/auth/signin"
              className="btn-primary relative mt-9 px-9 py-3.5 text-base"
            >
              Join Snívať
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}



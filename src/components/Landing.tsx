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

// Landing page content. Rendered by src/app/page.tsx when the visitor is signed out.

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
    v: "Every role is a step in a longer sequence. You are not climbing a ladder — you are growing like a living thing.",
  },
  {
    k: "Connection",
    v: "Knowledge flows fastest between people. The shortest distance between a question and an answer is another person.",
  },
  {
    k: "Evolution",
    v: "Careers bend, branch, and recombine. What feels like a detour often becomes the path.",
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
      {/* ════════════════════════ HERO (100vh) ════════════════════════ */}
      <section className="relative flex min-h-[100vh] flex-col items-center justify-center px-5 text-center">
        <div
          className="reveal mb-10 flex justify-center"
          style={{ animationDelay: "0ms" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-4 py-1.5 text-xs font-medium text-ink-muted backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
            A living network for talent
          </span>
        </div>

        <h1
          className="display-1 max-w-5xl text-ink reveal"
          style={{ animationDelay: "100ms" }}
        >
          Where talent
          <br />
          <span className="text-accent">evolves.</span>
        </h1>

        <p
          className="lead reveal mt-10 max-w-xl text-ink-muted"
          style={{ animationDelay: "220ms" }}
        >
          Every connection is a strand. Every career is a living sequence —
          bending, branching, growing toward the light.
        </p>

        <div
          className="reveal mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "340ms" }}
        >
          <Link
            href="/auth/signin"
            className="btn-primary px-8 py-3.5 text-base"
          >
            Begin Evolving
          </Link>
          <Link
            href="/community"
            className="btn-outline px-8 py-3.5 text-base"
          >
            Explore
          </Link>
        </div>

        {/* Scroll indicator */}
        <div
          className="reveal absolute bottom-10 left-1/2 -translate-x-1/2 scroll-bob"
          style={{ animationDelay: "500ms" }}
        >
          <svg
            className="h-6 w-6 text-ink-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ════════════════════════ THREE CURRENTS ════════════════════════ */}
      <section className="px-5 py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-24 max-w-2xl">
            <p className="eyebrow mb-5">Three ways to grow</p>
            <h2 className="display-2 text-ink">
              One network.
              <br />
              Three currents.
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {CURRENTS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="card card-hover group flex flex-col p-10 reveal"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-accent-tint text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-ink">
                    <Icon className="h-7 w-7" />
                  </div>
                  <p className="eyebrow mb-3">{s.eyebrow}</p>
                  <h3 className="display-3 text-ink">{s.title}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                    {s.description}
                  </p>
                  <span className="mt-8 text-sm font-medium text-accent">
                    Enter →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════ PARTIAL DNA PHILOSOPHY ════════════════════════ */}
      <section className="px-5 py-40">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-6 justify-center">Partial DNA</p>
          <h2 className="display-2 text-ink">
            Every person changes.
            <br />
            Every skill connects.
            <br />
            <span className="text-accent">
              Every opportunity creates another strand.
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-24 grid max-w-5xl gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.k} className="bg-surface p-10">
              <p className="eyebrow mb-4">{p.k}</p>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {p.v}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════ GROW ════════════════════════ */}
      <section className="px-5 pb-40">
        <div className="mx-auto max-w-6xl">
          <div className="mb-20 text-center">
            <p className="eyebrow mb-5 justify-center">Grow</p>
            <h2 className="display-2 text-ink">Three things happen here.</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {GROW.map((g, i) => {
              const G = g.Icon;
              return (
                <div
                  key={g.title}
                  className="card p-10 reveal text-center"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent-tint text-accent">
                    <G className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-ink">
                    {g.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {g.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════ COMMUNITY FEED ════════════════════════ */}
      <section className="px-5 pb-40">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-4">From the community</p>
              <h2 className="display-2 text-ink">Quiet wins, shared.</h2>
            </div>
            <Link
              href="/community"
              className="btn-outline px-6 py-2.5 text-sm"
            >
              See all →
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="card p-12 text-center text-ink-muted">
              The first story could be yours.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {posts.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  className="card card-hover flex flex-col p-8 reveal"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <Avatar
                      name={p.author?.name}
                      image={p.author?.image}
                      size={40}
                    />
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {p.author?.name || "Someone"}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {timeAgo(p.createdAt)}
                      </p>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold leading-snug text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                    {p.content}
                  </p>
                  <div className="mt-auto flex items-center gap-4 border-t border-line pt-5 text-xs text-ink-faint">
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z" /></svg>
                      {Math.floor(Math.random() * 200) + 20}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                      {p._count?.comments || 0}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-16 text-center">
            <Link href="/community" className="btn-primary px-8 py-3.5 text-base">
              Join the community
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════ CTA ════════════════════════ */}
      <section className="px-5 pb-40">
        <div className="mx-auto max-w-4xl">
          <div
            className="card relative overflow-hidden p-16 text-center sm:p-24"
            style={{ boxShadow: "var(--shadow-xl)" }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)",
                backgroundSize: "32px 32px",
              }}
            />
            <h2 className="display-2 relative text-ink">
              Your next strand
              <br />
              starts here.
            </h2>
            <p className="lead relative mx-auto mt-6 max-w-md text-ink-muted">
              Sign in takes seconds. Grow from there.
            </p>
            <Link
              href="/auth/signin"
              className="btn-primary relative mt-10 px-8 py-3.5 text-base"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

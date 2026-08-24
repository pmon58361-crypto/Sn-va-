import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Snívať",
};

// NOTE FOR THE OWNER: this is honest boilerplate tailored to what Snívať
// actually does today. Have a lawyer review before serious scale.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow mb-2">Legal</p>
      <h1 className="text-3xl font-black tracking-tight text-ink">
        Terms of Service
      </h1>
      <p className="mt-1 text-sm text-ink-faint">
        Last updated: August 2026 · Plain-language version, because legal
        walls of text help nobody.
      </p>

      <div className="prose-section space-y-8 pt-8 text-[15px] leading-relaxed text-ink-muted [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink">
        <section>
          <h2>What Snívať is</h2>
          <p>
            Snívať is a small community app: you share posts, stories and
            messages, follow people, and browse or offer work. It is run by an
            independent operator (not a company with a legal department — yet).
          </p>
        </section>

        <section>
          <h2>Your account</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be at least 13 years old to have an account.</li>
            <li>
              One human per account. You are responsible for what happens
              under your login.
            </li>
            <li>
              Accounts can be suspended or banned for breaking these rules.
              You can also deactivate your own account anytime from Settings.
            </li>
          </ul>
        </section>

        <section>
          <h2>Your content</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You own what you post. We don&apos;t claim ownership of your
              words, photos or stories.
            </li>
            <li>
              You give Snívať permission to store and display your content
              inside the app — that&apos;s the whole license, and it ends when
              your content is deleted.
            </li>
            <li>
              Don&apos;t post anything you don&apos;t have the rights to, and
              don&apos;t post other people&apos;s private information.
            </li>
          </ul>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>No harassment, hate speech, spam, scams or illegal content.</li>
            <li>
              No impersonating people, scraping, or automated abuse of the
              service.
            </li>
            <li>
              Job listings must be genuine. Misleading applicants is a bannable
              offense.
            </li>
            <li>
              Be decent. Reports from the community are reviewed by humans.
            </li>
          </ul>
        </section>

        <section>
          <h2>Moderation</h2>
          <p>
            Posts reported enough times are hidden automatically pending
            review. Moderators can hide or permanently remove content, dismiss
            reports, and ban accounts. If we action something by mistake,
            contact us — humans make mistakes in both directions.
          </p>
        </section>

        <section>
          <h2>Ads</h2>
          <p>
            Snívať may show ads from independent advertisers in the feed and
            sidebar. Ads are clearly labeled, served by Snívať itself, and we
            do not sell your personal data to advertisers or anyone else.
          </p>
        </section>

        <section>
          <h2>No guarantee of service</h2>
          <p>
            Snívať is provided as-is, free of charge. We work hard on uptime,
            but the service may change, break temporarily, or shut down. Your
            data matters to us (see the Privacy Policy), but always keep your
            own copies of anything you&apos;d hate to lose.
          </p>
        </section>

        <section>
          <h2>Governing law &amp; contact</h2>
          <p>
            These terms are governed by applicable local law. Questions,
            takedowns and account requests:{" "}
            <a
              href="mailto:pmon58361@gmail.com"
              className="text-accent hover:underline"
            >
              pmon58361@gmail.com
            </a>
            , or use the report button on any content.
          </p>
        </section>

        <p className="pt-4 text-sm text-ink-faint">
          See also our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/copyright" className="text-accent hover:underline">
            Copyright / DMCA notice
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

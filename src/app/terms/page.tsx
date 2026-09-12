import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The short, readable rules for using Snívať — accounts, content and conduct.",
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
              No impersonating other people, and no selling or transferring
              accounts — badges and status stay with the human who earned
              them.
            </li>
            <li>
              Accounts can be suspended or banned for breaking these rules.
              You can also deactivate your own account anytime from Settings.
            </li>
          </ul>
        </section>

        <section>
          <h2>Your content</h2>
          <p className="mb-3 rounded-xl border border-accent/40 bg-accent-tint px-4 py-3 font-semibold text-ink">
            You own your work. Snívať doesn&apos;t — not your renders, not
            your workflows, not your words.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You grant Snívať a worldwide, royalty-free, non-exclusive
              license to host, store, reproduce, resize, format, display and
              distribute your content, strictly as needed to operate the
              service: rendering posts, thumbnails, share cards and feeds.
              That&apos;s the whole license, and it ends when your content is
              deleted.
            </li>
            <li>
              Honest footnote: cached copies (share cards, CDN copies) can
              linger briefly after deletion, then they&apos;re gone too.
              Backup copies may persist a short while for safety and are
              never served.
            </li>
            <li>
              Don&apos;t post anything you don&apos;t have the rights to, and
              don&apos;t post other people&apos;s private information.
              Repeat copyright infringers lose their accounts.
            </li>
          </ul>
        </section>

        <section>
          <h2>AI-edited media</h2>
          <p>
            Before/after posts are manipulated media by design — that&apos;s
            the craft, and honesty is what makes it worth looking at:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Label AI-generated or heavily edited work as such. The process
              notes exist for exactly this.
            </li>
            <li>
              Passing someone else&apos;s work off as your own — AI or
              otherwise — is a bannable offense.
            </li>
            <li>
              Don&apos;t make edits that deceive (fake events, fake people,
              fake quotes). Showcase skill, not fiction.
            </li>
          </ul>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>No harassment, hate speech, spam, scams or illegal content.</li>
            <li>
              Zero tolerance for sexual content involving minors. It is
              removed, reported, and the account is gone.
            </li>
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
          <h2>Jobs &amp; hiring</h2>
          <p>
            Snívať is the venue, not a party: hirers and freelancers contract
            with each other, at their own risk. Nobody here is anyone&apos;s
            employee, agent, or partner because of Snívať, and Snívať is not
            liable for payment disputes, fraud, or a hire gone wrong. Check
            references, use contracts, never pay upfront to strangers.
          </p>
        </section>

        <section>
          <h2>Badges, streaks &amp; status</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Founding badges, streaks, and status markers are promotional:
              no cash value, non-transferable, and revocable for abuse.
            </li>
            <li>
              Leaderboard position reflects community reactions, not an
              objective measure of artistic quality.
            </li>
          </ul>
        </section>

        <section>
          <h2>Storage &amp; availability</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Media storage isn&apos;t guaranteed forever, and upload quotas
              apply. Keep your own copies of anything you&apos;d hate to lose.
            </li>
            <li>
              Unclaimed uploads (files uploaded but never attached to a post)
              may be deleted after a grace period.
            </li>
            <li>
              Snívať runs on third-party infrastructure (hosting, database,
              image storage). Outages on their side are out of our hands, and
              features may change or retire.
            </li>
          </ul>
        </section>

        <section>
          <h2>Challenges</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Weekly challenges rank entries by community reactions unless a
              challenge states otherwise. Leaderboards are computed live from
              real votes — never edited by hand.
            </li>
            <li>
              Prizes, if any, are stated on the challenge itself. No stated
              prize means the reward is glory (and the entry badge on your
              post).
            </li>
            <li>
              By entering, you agree your entry may be featured on the
              challenge page and leaderboard.
            </li>
          </ul>
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
          <h2>Advertising with us</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Ads must be truthful and must not impersonate people, brands,
              or Snívať itself.
            </li>
            <li>
              We can reject, pause, or remove any ad at our discretion, with
              unspent budget returned.
            </li>
            <li>Spending is capped by the budget you set. No surprises.</li>
          </ul>
        </section>

        <section>
          <h2>Payments</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Payments are processed securely by Stripe. Snívať never sees
              or stores your card details.
            </li>
            <li>
              Ad spend is prepaid and generally non-refundable, except
              unspent budget on ads we reject or remove.
            </li>
            <li>
              If a payment fails or looks fraudulent, the related service
              (ads, features) is paused until it&apos;s resolved.
            </li>
          </ul>
        </section>

        <section>
          <h2>No guarantee of service</h2>
          <p>
            Snívať is provided as-is, free of charge. We work hard on uptime,
            but the service may change, break temporarily, or shut down. We
            don&apos;t promise your content will reach an audience, or that it
            will never be lost. Your data matters to us (see the Privacy
            Policy), but always keep your own copies of anything you&apos;d
            hate to lose.
          </p>
        </section>

        <section>
          <h2>Leaving &amp; deletion</h2>
          <p>
            Deactivate anytime from Settings; request full deletion by email
            and your account and content are permanently removed, except
            minimal records we must retain for safety and legal reasons
            (abuse logs, transaction receipts). Deleted content stops being
            served immediately; cached copies fade as described above.
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

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Copyright / DMCA",
  description: "How to report copyrighted content or file a takedown request on Snívať.",
};

// NOTE FOR THE OWNER: simple notice + takedown process routed through the
// existing report system. Formal DMCA-agent registration is only needed at
// US scale — lawyer pass recommended before then.
export default function CopyrightPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow mb-2">Legal</p>
      <h1 className="text-3xl font-black tracking-tight text-ink">
        Copyright &amp; DMCA
      </h1>
      <p className="mt-1 text-sm text-ink-faint">
        Last updated: August 2026 · Short version: we respect copyright and we
        act fast on reports.
      </p>

      <div className="prose-section space-y-8 pt-8 text-[15px] leading-relaxed text-ink-muted [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink">
        <section>
          <h2>Reporting copyrighted content</h2>
          <p>
            If your work appears on Snívať without permission, use the{" "}
            <strong>report button</strong> on the post, comment or message and
            choose a reason — reports go straight to moderation. For a formal
            takedown request (DMCA-style), email{" "}
            <a
              href="mailto:pmon58361@gmail.com"
              className="text-accent hover:underline"
            >
              pmon58361@gmail.com
            </a>{" "}
            with:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the link to the content on Snívať,</li>
            <li>a description of the original work,</li>
            <li>your contact information,</li>
            <li>
              a statement that you own the rights and believe the use is
              unauthorized.
            </li>
          </ul>
        </section>

        <section>
          <h2>What happens next</h2>
          <p>
            Reported content can be hidden immediately pending review
            (automatically, once several independent reports agree).
            Confirmed infringements are removed permanently and repeat
            uploaders lose their accounts. If content you reported is removed,
            we&apos;ll let you know.
          </p>
        </section>

        <section>
          <h2>Counter-notices</h2>
          <p>
            Believe your content was removed by mistake? Reply to the action
            notice or email us with why you believe it was authorized. We
            restore things when the facts support it.
          </p>
        </section>

        <section>
          <h2>Repeat infringers</h2>
          <p>Accounts that repeatedly post others&apos; work are banned.</p>
        </section>

        <p className="pt-4 text-sm text-ink-faint">
          See also our{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

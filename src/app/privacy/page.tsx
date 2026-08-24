import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Snívať",
};

// NOTE FOR THE OWNER: honest boilerplate matching actual behavior. Lawyer
// pass recommended before serious scale (GDPR-style formalities, etc.).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow mb-2">Legal</p>
      <h1 className="text-3xl font-black tracking-tight text-ink">
        Privacy Policy
      </h1>
      <p className="mt-1 text-sm text-ink-faint">
        Last updated: August 2026 · The short version: we collect the minimum,
        we don&apos;t sell anything, your email is yours.
      </p>

      <div className="prose-section space-y-8 pt-8 text-[15px] leading-relaxed text-ink-muted [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink">
        <section>
          <h2>What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account basics: name and email address.</li>
            <li>
              A password hash — we never store or see your actual password.
            </li>
            <li>
              Content you create: posts, photos, stories, comments and direct
              messages.
            </li>
            <li>
              Basic activity needed for features to work (who viewed a story,
              who liked a post).
            </li>
          </ul>
        </section>

        <section>
          <h2>What we do NOT do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>No third-party ad trackers or analytics spies.</li>
            <li>We never sell or rent your data. To anyone. Ever.</li>
            <li>
              No advertising profiles built about you — ads on Snívať are
              served directly by Snívať.
            </li>
          </ul>
        </section>

        <section>
          <h2>Who can see what</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email is private to you. It is never shown to others.</li>
            <li>
              Public profiles show your name, bio and posts. Private profiles
              hide everything but your name.
            </li>
            <li>
              Direct messages are between you and the recipient. They are
              stored so threads persist, and are only ever reviewed if a
              report requires it.
            </li>
          </ul>
        </section>

        <section>
          <h2>Where things live</h2>
          <p>
            Snívať runs on standard cloud infrastructure: app hosting (Vercel),
            database (Neon) and image hosting (Cloudinary). These providers
            process data only to run the service.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Deactivate anytime from Settings — your profile and content stop
              being visible immediately; signing back in reactivates.
            </li>
            <li>
              Want full deletion? Email{" "}
              <a
                href="mailto:pmon58361@gmail.com"
                className="text-accent hover:underline"
              >
                pmon58361@gmail.com
              </a>{" "}
              and your account and content will be permanently removed.
            </li>
            <li>Delete any individual post or story yourself, anytime.</li>
          </ul>
        </section>

        <p className="pt-4 text-sm text-ink-faint">
          See also our{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms of Service
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

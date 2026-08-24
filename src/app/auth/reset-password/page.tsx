import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { LegalLinks } from "@/components/legal/LegalLinks";

export const metadata: Metadata = {
  title: "Set a new password — Snívať",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "body{background:#0a0a0b!important}" }} />
      <main className="page-flood relative flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] px-5 py-16">
        <div className="reveal relative z-10 w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Set a new password
            </h1>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/70 p-6 backdrop-blur sm:p-8">
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className="text-center">
                <p
                  role="alert"
                  className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300"
                >
                  // This reset link is invalid or already used.
                </p>
                <Link
                  href="/auth/forgot-password"
                  className="mt-4 inline-block font-mono text-xs text-white/40 transition-colors hover:text-white/70"
                >
                  request a new link →
                </Link>
              </div>
            )}
          </div>

          <div className="mt-10">
            <LegalLinks variant="dark" />
          </div>
        </div>
      </main>
    </>
  );
}

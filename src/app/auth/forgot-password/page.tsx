import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LegalLinks } from "@/components/legal/LegalLinks";

export const metadata: Metadata = {
  title: "Reset password — Snívať",
};

export default function ForgotPasswordPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "body{background:#0a0a0b!important}" }} />
      <main className="page-flood relative flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] px-5 py-16">
        <div className="reveal relative z-10 w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Enter your email and we&apos;ll send a single-use reset link
              (valid 10 minutes).
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/70 p-6 backdrop-blur sm:p-8">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-center font-mono text-xs text-white/40">
            <Link href="/auth/signin" className="transition-colors hover:text-white/70">
              ← back to sign in
            </Link>
          </p>

          <div className="mt-10">
            <LegalLinks variant="dark" />
          </div>
        </div>
      </main>
    </>
  );
}

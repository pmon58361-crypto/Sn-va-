import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 text-center">
      {/* Terminal-flavored miss, matching the landing's mono language */}
      <p className="font-mono text-xs text-ink-faint">
        <span className="text-accent">$</span> GET{" "}
        <span className="text-ink-muted">/this-page</span> →{" "}
        <span className="font-semibold text-accent">404</span>
      </p>
      <h1 className="mt-5 font-mono text-5xl font-black tracking-tight text-ink">
        ~/404
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        This page doesn&apos;t exist — or it moved while you weren&apos;t
        looking. Your story isn&apos;t over, though.
      </p>
      <div className="mt-7 flex items-center gap-3">
        <Link href="/" className="btn-primary">
          Go home
        </Link>
        <Link href="/community" className="btn-outline">
          Browse community
        </Link>
      </div>
    </div>
  );
}

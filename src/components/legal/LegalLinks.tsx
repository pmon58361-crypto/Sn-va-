import Link from "next/link";

// Shared legal links — mounted where users expect policies (sign-in,
// settings). Styling adapts via the variant prop to each surface's theme.
export function LegalLinks({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const cls =
    variant === "dark"
      ? "font-mono text-[11px] text-white/30 transition-colors hover:text-white/60"
      : "text-xs text-ink-faint transition-colors hover:text-accent";
  const sep = variant === "dark" ? "text-white/15" : "text-line-strong";
  return (
    <nav aria-label="Legal" className={`flex items-center justify-center gap-2 ${cls}`}>
      <Link href="/terms">Terms</Link>
      <span aria-hidden className={sep}>
        ·
      </span>
      <Link href="/privacy">Privacy</Link>
      <span aria-hidden className={sep}>
        ·
      </span>
      <Link href="/copyright">Copyright</Link>
    </nav>
  );
}

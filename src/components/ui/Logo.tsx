import Link from "next/link";

/**
 * Snívať logo — the creator's official "S" mark as an image asset
 * (public/logo.png, transparency preserved). Inverted in dark mode so
 * the black mark stays visible; natural black in light mode.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center overflow-hidden rounded-[22%] bg-surface transition-transform duration-300 group-hover:scale-105"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className="gm-logo-img"
        style={{ width: size * 0.78, height: size * 0.78 }}
      />
    </span>
  );
}

export function Logo({
  size = 30,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Snívať home">
      <LogoMark size={size} />
      {withWordmark && (
        <span className="text-[1.15rem] font-bold tracking-tight">
          <span className="text-ink">Sní</span>
          <span className="text-accent">vať</span>
        </span>
      )}
    </Link>
  );
}

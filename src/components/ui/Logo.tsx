import Link from "next/link";

/**
 * Snívať logo — official angular-S mark on black (user's original raster).
 * Lives at /logo.png; also used as the browser tab icon via src/app/icon.png.
 * The black square reads identically on dark and light themes.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="overflow-hidden rounded-[22%] transition-transform duration-300 group-hover:scale-105"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full"
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
    <Link href="/community" className="group flex items-center gap-2.5" aria-label="Snívať home">
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

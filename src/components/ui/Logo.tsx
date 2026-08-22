import Link from "next/link";

/**
 * Snívať logo — official gradient mark (teal→lime tile, squared-S glyph).
 * Vector lives at /logo.svg; also used as the browser tab icon via
 * src/app/icon.svg. Works identically on dark and light themes.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="overflow-hidden rounded-[22%] transition-transform duration-300 group-hover:scale-105"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
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

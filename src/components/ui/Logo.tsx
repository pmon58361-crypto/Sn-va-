import Link from "next/link";

/**
 * Snívať logo — the creator's official "S" mark, inlined as vector
 * (black on transparent). Inverted in dark mode so the black mark stays
 * visible; natural black in light mode.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const id = `snivat-slash-${size}`;
  return (
    <span
      className="grid place-items-center overflow-hidden rounded-[22%] bg-surface transition-transform duration-300 group-hover:scale-105"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 128 128"
        className="gm-logo-img"
        style={{ width: size * 0.78, height: size * 0.78 }}
        aria-hidden
      >
        <defs>
          <mask id={id}>
            <rect width="128" height="128" fill="#fff" />
            <path d="M-12 88 L88 -12 L97 -3 L-3 97 Z" fill="#000" />
            <path d="M14 130 L118 26 L127 35 L23 139 Z" fill="#000" />
          </mask>
        </defs>
        <g mask={`url(#${id})`} fill="#000">
          {/* squared S: top bar, NE->SW diagonal, bottom bar */}
          <path d="M30 10 H112 V36 H30 Z" />
          <path d="M86 10 H114 L56 118 H28 Z" />
          <path d="M16 92 H98 V118 H16 Z" />
          {/* stripe extensions beyond the silhouette */}
          <path d="M90 30 L114 6 L123 15 L99 39 Z" />
          <path d="M100 44 L118 26 L126 34 L108 52 Z" />
          <path d="M28 98 L10 116 L1 107 L19 89 Z" />
          <path d="M20 84 L6 98 L-2 90 L12 76 Z" />
        </g>
      </svg>
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

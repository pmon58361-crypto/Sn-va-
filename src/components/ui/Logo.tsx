import Link from "next/link";

/**
 * Snívať logo mark.
 *
 * Reference (brand sheet):
 *  - Rounded-square tile with a VERTICAL gradient: dark teal (#006655) top
 *    → light green (#66CC66) bottom.
 *  - A white, two-lobe leaf "S" (a thick ribbon, not a thin stroke) — the
 *    upper lobe opens left, the lower lobe opens right.
 *  - A white 5-point star sitting where the two lobes meet.
 *
 * This is a hand-coded SVG recreation of the brand mark. It is close in
 * structure (gradient direction, thick two-lobe S, centered star) but a
 * pixel-perfect match needs the original vector source — drop that in
 * /public and replace this if you have it.
 *
 * The wordmark renders "Sní" in ink (black) and "vať" in the user's
 * selected accent color, so it reacts to the Settings accent choice.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const fill = "snivat-fill";
  const glow = "snivat-star-glow";
  return (
    <span
      className="relative grid place-items-center rounded-[22%] transition-transform duration-300 group-hover:scale-105"
      style={{ width: size, height: size, boxShadow: "var(--shadow-sm)" }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        role="img"
        aria-label="Snívať"
      >
        <defs>
          <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#006655" />
            <stop offset="100%" stopColor="#66cc66" />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Tile */}
        <rect x="0" y="0" width="32" height="32" rx="7" fill={`url(#${fill})`} />

        {/* Two-lobe leaf "S" — a thick white ribbon (not a thin stroke).
            Upper lobe opens left, lower lobe opens right. */}
        <path
          d="
            M 10.5 5.5
            C 19.5 5.5, 23 11, 21 15
            C 19.5 18, 16 18.5, 13.8 17
            C 11.8 15.6, 12.4 12.8, 14.6 12.3
            C 16.8 11.8, 18.3 13.4, 18 15.2
            C 17.6 19.2, 13 22.8, 9.5 21.5
          "
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Star — sits at the crossover of the two lobes */}
        <circle cx="16" cy="16" r="4.8" fill={`url(#${glow})`} />
        <Star cx={16} cy={16} r={2.3} fill="#ffffff" />
      </svg>
    </span>
  );
}

// A 5-point star centered at (cx, cy) with outer radius r.
function Star({
  cx,
  cy,
  r,
  fill,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(
      `${(cx + Math.cos(ang) * radius).toFixed(2)},${(
        cy +
        Math.sin(ang) * radius
      ).toFixed(2)}`
    );
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

export function Logo({
  size = 30,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5"
      aria-label="Snívať home"
    >
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

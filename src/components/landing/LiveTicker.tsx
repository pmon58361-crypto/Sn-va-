"use client";

/**
 * LiveTicker — AnimatedList-style entrance for the landing terminal panel.
 * Items are REAL recent activity (posts + joins) serialized by the server;
 * the component never invents a row and renders nothing when the list is
 * empty. Staggered rise-in on mount; rows past `mobileCap` stay hidden on
 * small screens; prefers-reduced-motion flattens the stagger (the global
 * reduced-motion rule in globals.css also kills the animation itself).
 */

export type TickerItem = {
  id: string;
  kind: "post" | "join";
  time: string;
  name: string;
  verb?: string;
  title?: string;
  href?: string;
};

const KEYFRAMES = `
@keyframes ticker-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .ticker-row { animation: none !important; }
}
`;

export function LiveTicker({
  items,
  staggerMs = 110,
  mobileCap = 4,
}: {
  items: TickerItem[];
  staggerMs?: number;
  mobileCap?: number;
}) {
  if (items.length === 0) return null;
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      {items.map((item, i) => {
        const body = (
          <>
            <span className="text-white/30">[{item.time}]</span>{" "}
            <span className="text-amber-300">@{item.name}</span>{" "}
            <span className="text-white/50">
              {item.kind === "join" ? "joined the builders" : item.verb || "posted"}
            </span>{" "}
            {item.title && (
              <span className="text-white/85">&quot;{item.title}&quot;</span>
            )}
          </>
        );
        const cls = `ticker-row block truncate${i >= mobileCap ? " hidden sm:block" : ""}`;
        return item.href ? (
          <a
            key={item.id}
            href={item.href}
            className={`${cls} transition-colors hover:text-amber-200`}
            style={{
              animation: reduced
                ? undefined
                : `ticker-in 0.45s cubic-bezier(0.16,1,0.3,1) both`,
              animationDelay: reduced ? undefined : `${i * staggerMs}ms`,
            }}
          >
            {body}
          </a>
        ) : (
          <div
            key={item.id}
            className={cls}
            style={{
              animation: reduced
                ? undefined
                : `ticker-in 0.45s cubic-bezier(0.16,1,0.3,1) both`,
              animationDelay: reduced ? undefined : `${i * staggerMs}ms`,
            }}
          >
            {body}
          </div>
        );
      })}
    </>
  );
}

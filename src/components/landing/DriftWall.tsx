"use client";

// ── DriftWall ────────────────────────────────────────────────────────────────
// Infinite drifting 3D wall of image tiles. Pure rAF + transform3d — no
// animation libraries, no canvas, bounded DOM (columns × visible rows only,
// recycled). Accessibility non-negotiable: prefers-reduced-motion renders a
// STATIC tilted grid. Mobile halves columns and caps speed.
//
// Contract (all props honored): items[{image,title,href}], columns,
// tileWidth, tileHeight, gap, tilt, turn, perspective, depth, speed,
// direction("up"/"down"), variance, parallax, lift, fade, dim, overlayColor,
// radius, roll, pauseOnHover, grayscale.

import { useEffect, useMemo, useRef, useState } from "react";

export type DriftItem = { image?: string | null; title: string; href?: string };

export type DriftWallProps = {
  items: DriftItem[];
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  gap?: number;
  tilt?: number;
  turn?: number;
  perspective?: number;
  depth?: number;
  speed?: number;
  direction?: "up" | "down";
  variance?: number;
  parallax?: number;
  lift?: number;
  fade?: number;
  dim?: number;
  overlayColor?: string;
  radius?: number;
  roll?: number;
  pauseOnHover?: boolean;
  grayscale?: boolean;
};

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function DriftWall({
  items,
  columns = 7,
  tileWidth = 190,
  tileHeight = 130,
  gap = 14,
  tilt = 6,
  turn = 10,
  perspective = 1200,
  depth = 600,
  speed = 28,
  direction = "up",
  variance = 0.35,
  parallax = 0.6,
  lift = 24,
  fade = 0.55,
  dim = 0.45,
  overlayColor = "rgba(10,10,11,0.72)",
  radius = 14,
  roll = 2,
  pauseOnHover = true,
  grayscale = false,
}: DriftWallProps) {
  const [reduced] = useState(REDUCED_MOTION);
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cols = Math.max(2, narrow ? Math.ceil(columns / 2) : columns);
  const cellH = tileHeight + gap;

  // Deterministic per-column personality (variance-driven).
  const colTraits = useMemo(() => {
    const t = [];
    for (let c = 0; c < cols; c++) {
      t.push({
        speedJitter: 1 + (hash2(c, 7) - 0.5) * 2 * variance,
        phase: hash2(c, 13),
        depthJitter: hash2(c, 29),
        rollJitter: (hash2(c, 41) - 0.5) * 2,
        tiltJitter: (hash2(c, 57) - 0.5) * 2,
      });
    }
    return t;
  }, [cols, variance]);

  // ── Reduced motion / mobile-static fallback ───────────────────────────
  if (reduced || narrow) {
    // Static tilted grid — same visuals, zero animation, tiny DOM.
    const staticCols = narrow ? 3 : Math.min(cols, 5);
    const staticRows = 3;
    const tiles = [];
    for (let c = 0; c < staticCols; c++) {
      for (let r = 0; r < staticRows; r++) {
        const idx = (c * 31 + r * 17) % Math.max(items.length, 1);
        const it = items[idx];
        const zj = hash2(c, r) * depth * 0.5;
        tiles.push(
          <div
            key={`${c}-${r}`}
            className="pointer-events-none overflow-hidden bg-gradient-to-br from-white/[0.07] to-white/[0.02]"
            style={{
              width: tileWidth,
              height: tileHeight,
              borderRadius: radius,
              transform: `translate3d(0,0,${-zj}px) rotateX(${tilt}deg) rotateY(${turn}deg) rotateZ(${roll * (hash2(c, r + 3) - 0.5)}deg)`,
              filter: `brightness(${1 - dim * 0.5})${grayscale ? " grayscale(1)" : ""}`,
            }}
          >
            {it?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xl font-black text-white/25">
                {(it?.title || "S").charAt(0)}
              </div>
            )}
          </div>
        );
      }
    }
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ perspective: `${perspective}px`, opacity: 1 - fade * 0.4 }}
      >
        <div
          className="absolute inset-[-40px] flex flex-wrap content-start justify-center gap-[14px]"
          style={{ transformStyle: "preserve-3d", transform: `translateY(${direction === "up" ? 0 : -tileHeight}px)` }}
        >
          {tiles}
        </div>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${overlayColor} 0%, transparent 30%, transparent 60%, ${overlayColor} 100%)`,
          }}
        />
      </div>
    );
  }

  // ── Animated mode ─────────────────────────────────────────────────────
  const rowsRef = useRef(0);
  const [rows, setRows] = useState(0);

  useEffect(() => {
    function measure() {
      const h = containerRef.current?.parentElement?.clientHeight || window.innerHeight;
      const r = Math.ceil(h / cellH) + 2;
      rowsRef.current = r;
      setRows(r);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellH]);

  useEffect(() => {
    setNarrow(window.innerWidth < 640);
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (!rows) return;
    const container = containerRef.current as HTMLDivElement | null;
    const world = worldRef.current as HTMLDivElement | null;
    const cc = container!, ww = world!;
    if (!cc || !ww) return;

    const dirSign = direction === "up" ? -1 : 1;
    const speedCap = narrow ? speed * 0.6 : speed;
    const vw = cc.clientWidth || window.innerWidth;
    const cellW = tileWidth + gap;
    const trackLen = rows * cellH;

    const offsets = new Array(cols).fill(0).map((_, c) => colTraits[c].phase * trackLen);
    let pausedUntilHover = false;
    let mx = 0, my = 0, cmx = 0, cmy = 0;
    let last = performance.now();
    let raf = 0;

    function onMove(e: MouseEvent) {
      const rect = cc.getBoundingClientRect();
      mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function onEnter() { pausedUntilHover = true; }
    function onLeave() { pausedUntilHover = false; }

    if (parallax > 0) cc.addEventListener("mousemove", onMove);
    if (pauseOnHover) {
      cc.addEventListener("mouseenter", onEnter);
      cc.addEventListener("mouseleave", onLeave);
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last);
      last = now;
      if (pausedUntilHover && pauseOnHover) return;

      cmx += (mx - cmx) * 0.06;
      cmy += (my - cmy) * 0.06;

      // Camera parallax on the world wrapper.
      ww.style.transform = `rotateX(${cmy * parallax * 3}deg) rotateY(${-cmx * parallax * 5}deg) translate3d(${cmx * parallax * 18}px, ${cmy * parallax * 12}px, 0)`;

      const t = now / 1000;
      for (let c = 0; c < cols; c++) {
        const tr = colTraits[c];
        offsets[c] = (offsets[c] + dirSign * speedCap * tr.speedJitter * (dt / 1000)) % trackLen;
        if (offsets[c] < 0) offsets[c] += trackLen;

        const centerX = (vw - cellW) / 2;
        const side = (c * cellW - centerX) / Math.max(vw, 1); // -0.5..0.5-ish

        for (let rI = 0; rI < rows; rI++) {
          const slotIdx = c * rows + rI;
          const el = slotRefs.current[slotIdx];
          if (!el) continue;

          const worldY = rI * cellH - offsets[c];
          const wrappedY = ((worldY % trackLen) + trackLen) % trackLen - cellH;
          const vRow = Math.floor((worldY - wrappedY) / cellH) + Math.round(worldY / cellH) * 0; // stable-ish id
          const y = wrappedY;

          const zDepth = -(tr.depthJitter * depth) - Math.abs(side) * depth * 0.35;
          const scale = perspective / (perspective + Math.abs(zDepth));
          const wob = Math.sin(t * 0.9 + tr.phase * 6 + rI) ;

          el.style.transform =
            `translate3d(${c * cellW + cmx * parallax * 14}px, ${y + cmy * parallax * 10}px, ${zDepth + lift * 0}) ` +
            `scale(${scale.toFixed(3)}) ` +
            `rotateX(${tilt + tr.tiltJitter * 2 + wob * 1.2}deg) ` +
            `rotateY(${turn * side * 2 + wob * 0.8}deg) ` +
            `rotateZ(${roll * tr.rollJitter + wob * 0.5}deg)`;

          const edgeFade =
            Math.min(1, Math.max(0, (y + cellH) / (cellH * 2))) *
            Math.min(1, Math.max(0, (trackLen - y) / (cellH * 2)));
          const bright = 1 - dim * (1 - scale * 0.85);
          el.style.opacity = String(Math.max(0.05, edgeFade * (1 - fade * (1 - scale))));
          el.style.filter =
            `brightness(${bright.toFixed(3)})` + (grayscale ? " grayscale(1)" : "");
          el.style.zIndex = String(1000 - Math.round(zDepth));

          // Recycle content when the virtual row changes.
          const itemKey = `${c}:${Math.floor((offsets[c] + y) / cellH)}:${vRow}`;
          const wantIdx = items.length
            ? Math.abs((c * 131 + Math.floor(hash2(c, rI) * 997) + rI * 7) % items.length)
            : 0;
          const it = items[wantIdx];
          if (el.dataset.key !== itemKey.slice(0, 24)) {
            el.dataset.key = itemKey.slice(0, 24);
          }
          const img = imgRefs.current[slotIdx];
          if (img && img.dataset.want !== String(wantIdx)) {
            img.dataset.want = String(wantIdx);
            const src = it?.image || "";
            if (src) {
              img.src = src;
              img.style.display = "";
              const capEl = capRefs.current[slotIdx];
              if (capEl) capEl.textContent = "";
            } else {
              img.removeAttribute("src");
              img.style.display = "none";
              const capEl = capRefs.current[slotIdx];
              if (capEl) capEl.textContent = (it?.title || "S").charAt(0).toUpperCase();
            }
          }
        }
      }
      void vw;
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      cc.removeEventListener("mousemove", onMove);
      cc.removeEventListener("mouseenter", onEnter);
      cc.removeEventListener("mouseleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows, cols, cellH, tileWidth, tileHeight, depth, speed, direction, variance,
    parallax, lift, fade, dim, radius, roll, grayscale, pauseOnHover, narrow,
    colTraits, items,
  ]);

  const totalSlots = cols * Math.max(rows, 1);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ perspective: `${perspective}px` }}
    >
      <div
        ref={worldRef}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d", willChange: "transform" }}
      >
        {Array.from({ length: totalSlots }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.02] will-change-transform"
            style={{
              width: tileWidth,
              height: tileHeight,
              borderRadius: radius,
              transform: "translate3d(-500px,-500px,0)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(el) => {
                imgRefs.current[i] = el;
              }}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                const im = e.currentTarget;
                im.style.display = "none";
                const letter = capRefs.current[i];
                if (letter)
                  letter.textContent = (im.alt || "S").charAt(0).toUpperCase();
              }}
            />
            <div
              ref={(el) => {
                capRefs.current[i] = el;
              }}
              aria-hidden
              className="grid h-full w-full place-items-center bg-gradient-to-br from-accent/25 to-like/15 text-3xl font-black text-white/70"
            />
          </div>
        ))}
      </div>

      {/* overlayColor tint + readability fades */}
      <div
        className="absolute inset-0"
        style={{
          background: overlayColor,
          backdropFilter: "blur(1px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,11,0.92) 0%, transparent 22%, transparent 62%, rgba(10,10,11,0.94) 100%)",
        }}
      />
    </div>
  );
}

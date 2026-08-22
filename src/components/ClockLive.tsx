"use client";

import { useEffect, useRef } from "react";

// Cinematic fullscreen pocket-watch stage.
// - Watch fills the viewport height, centered like a product film shot
// - Real-time hour/minute/second hands over the illustration
// - children float above (nav, copy, CTAs)
export function ClockLive({
  fullscreen = false,
  children,
}: {
  fullscreen?: boolean;
  children?: React.ReactNode;
}) {
  const secRef = useRef<SVGGElement>(null);
  const minRef = useRef<SVGGElement>(null);
  const hourRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      secRef.current?.setAttribute("transform", `rotate(${s * 6} 50 50)`);
      minRef.current?.setAttribute("transform", `rotate(${m * 6} 50 50)`);
      hourRef.current?.setAttribute("transform", `rotate(${h * 30} 50 50)`);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!fullscreen) {
    return (
      <div className="clock-live" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clock.jpg" alt="" draggable={false} />
        <svg viewBox="0 0 100 100" className="hands">
          <g ref={hourRef}>
            <line x1="50" y1="53.5" x2="50" y2="31" stroke="#efe6cf" strokeWidth="3.4" strokeLinecap="round" opacity="0.92" />
          </g>
          <g ref={minRef}>
            <line x1="50" y1="54.5" x2="50" y2="17" stroke="#f5edd8" strokeWidth="2.1" strokeLinecap="round" opacity="0.95" />
          </g>
          <g ref={secRef}>
            <line x1="50" y1="58" x2="50" y2="13" stroke="#c9a24b" strokeWidth="0.9" strokeLinecap="round" />
            <circle cx="50" cy="63" r="1.6" fill="#c9a24b" />
          </g>
          <circle cx="50" cy="50" r="2.6" fill="#1a1508" stroke="#c9a24b" strokeWidth="0.8" />
        </svg>
      </div>
    );
  }

  // ── FULLSCREEN STAGE ──
  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[#060607]">
      {/* Brass ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 55% at 50% 42%, rgba(201,162,75,0.16), transparent 70%)",
        }}
      />

      {/* The watch: fills height, perfectly centered */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2">
        <div className="clock-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clock.jpg" alt="" draggable={false} />
          <svg viewBox="0 0 100 100" className="hands">
            <g ref={hourRef}>
              <line x1="50" y1="53.5" x2="50" y2="31" stroke="#efe6cf" strokeWidth="3.4" strokeLinecap="round" opacity="0.92" />
            </g>
            <g ref={minRef}>
              <line x1="50" y1="54.5" x2="50" y2="17" stroke="#f5edd8" strokeWidth="2.1" strokeLinecap="round" opacity="0.95" />
            </g>
            <g ref={secRef}>
              <line x1="50" y1="58" x2="50" y2="13" stroke="#c9a24b" strokeWidth="0.9" strokeLinecap="round" />
              <circle cx="50" cy="63" r="1.6" fill="#c9a24b" />
            </g>
            <circle cx="50" cy="50" r="2.6" fill="#1a1508" stroke="#c9a24b" strokeWidth="0.8" />
          </svg>
        </div>
      </div>

      {/* Scrims */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

      {/* Floating UI */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 sm:p-10">
        <div className="pointer-events-auto">{children ?? null}</div>
        <div className="pointer-events-auto mx-auto w-full max-w-2xl pb-2 text-center">{/* bottom slot */}</div>
      </div>
    </div>
  );
}

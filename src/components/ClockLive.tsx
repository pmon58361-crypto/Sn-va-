"use client";

import { useEffect, useRef } from "react";

// Live analog pocket-watch.
// - default: compact medallion (hero/signin)
// - fullscreen: the watch IS the page — fills the viewport height,
//   UI floats on top via children.
export function ClockLive({
  fullscreen = false,
  children,
}: {
  fullscreen?: boolean;
  children?: React.ReactNode;
}) {
  const secRef = useRef<SVGGElement>(null);
  const minRef = useRef<SVGGElement>(null);
  const hourRef = useRef<SVGGElement>(null);

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

  if (fullscreen) {
    return (
      <div className="relative h-[100svh] w-full overflow-hidden bg-black" aria-hidden={false}>
        {/* Square stage keeps the face circular on any aspect ratio */}
        <div className="clock-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clock.jpg" alt="" draggable={false} />
          <Hands secRef={secRef} minRef={minRef} hourRef={hourRef} />
        </div>

        {/* Readability scrim at bottom for floating UI */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Floating UI layer */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 sm:p-8">
          <div className="pointer-events-auto flex justify-center">{/* top slot */}</div>
          <div className="mx-auto w-full max-w-xl text-center text-white">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`clock-live ${""}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/clock.jpg" alt="" draggable={false} />
      <Hands secRef={secRef} minRef={minRef} hourRef={hourRef} />
    </div>
  );
}

function Hands({
  secRef,
  minRef,
  hourRef,
}: {
  secRef: React.RefObject<SVGGElement>;
  minRef: React.RefObject<SVGGElement>;
  hourRef: React.RefObject<SVGGElement>;
}) {
  return (
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
  );
}

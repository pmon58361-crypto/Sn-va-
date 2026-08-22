"use client";

import { useEffect, useRef } from "react";

// Live analog clock built on top of the pocket-watch illustration.
// The image is circle-masked and tightly cropped to the mechanism;
// hour/minute/second hands rotate in real time on top of it.
export function ClockLive({ className = "" }: { className?: string }) {
  const secRef = useRef<SVGGElement>(null);
  const minRef = useRef<SVGGElement>(null);
  const hourRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = new Date();
      const ms = now.getMilliseconds();
      const s = now.getSeconds() + ms / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      if (secRef.current)
        secRef.current.setAttribute("transform", `rotate(${s * 6} 50 50)`);
      if (minRef.current)
        minRef.current.setAttribute("transform", `rotate(${m * 6} 50 50)`);
      if (hourRef.current)
        hourRef.current.setAttribute("transform", `rotate(${h * 30} 50 50)`);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`clock-live ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/clock.jpg" alt="" draggable={false} />

      {/* Hands overlay — viewBox maps to the square crop */}
      <svg viewBox="0 0 100 100" className="hands">
        {/* hour */}
        <g ref={hourRef}>
          <line
            x1="50" y1="53.5" x2="50" y2="31"
            stroke="#efe6cf" strokeWidth="3.4" strokeLinecap="round"
            opacity="0.92"
          />
        </g>
        {/* minute */}
        <g ref={minRef}>
          <line
            x1="50" y1="54.5" x2="50" y2="17"
            stroke="#f5edd8" strokeWidth="2.1" strokeLinecap="round"
            opacity="0.95"
          />
        </g>
        {/* second — thin brass needle */}
        <g ref={secRef}>
          <line
            x1="50" y1="58" x2="50" y2="13"
            stroke="#c9a24b" strokeWidth="0.9" strokeLinecap="round"
          />
          <circle cx="50" cy="63" r="1.6" fill="#c9a24b" />
        </g>
        {/* center cap */}
        <circle cx="50" cy="50" r="2.6" fill="#1a1508" stroke="#c9a24b" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

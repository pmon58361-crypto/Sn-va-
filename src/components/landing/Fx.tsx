"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Scroll progress bar — gold line across the very top.
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
      if (ref.current) ref.current.style.width = `${pct}%`;
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[70] h-[3px] bg-transparent">
      <div
        ref={ref}
        className="h-full bg-gradient-to-r from-[#c9a24b] via-[#e8c877] to-[#c9a24b]"
        style={{ width: "0%" }}
      />
    </div>
  );
}

// Cursor spotlight for the hero — sets --mx/--my CSS vars on its parent.
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const move = (e: MouseEvent) => {
      const r = host.getBoundingClientRect();
      host.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      host.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    host.addEventListener("mousemove", move);
    return () => host.removeEventListener("mousemove", move);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden md:block"
      style={{
        background:
          "radial-gradient(600px circle at var(--mx,50%) var(--my,40%), rgba(201,162,75,0.10), transparent 65%)",
      }}
    />
  );
}

// Reveal children when they scroll into view.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`io-reveal ${shown ? "io-revealed" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Mouse-following 3D tilt wrapper.
export function TiltCard({
  children,
  className = "",
  max = 10,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-6px)`;
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`will-change-transform [transform-style:preserve-3d] ${className}`}
      style={{ transition: "transform .35s cubic-bezier(.16,1,.3,1)" }}
    >
      {children}
    </div>
  );
}

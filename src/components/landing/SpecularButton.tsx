"use client";

import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle, Vec2 } from "ogl";

/**
 * SpecularButton — landing primary CTA.
 * A WebGL sheen lives behind the label: a gold specular pool that follows the
 * pointer and a rim light that breathes on the rounded edge. Decorative only —
 * the label is real HTML inside a real <a>, so keyboard and screen readers
 * never touch the canvas.
 *
 * Fallbacks: prefers-reduced-motion → no WebGL, static CSS sheen; coarse
 * pointers (touch) → the light self-sweeps on a slow sine instead of tracking;
 * rAF pauses when the tab is hidden or the button scrolls out of view;
 * devicePixelRatio capped at 2.
 */

const VERT = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 v_uv;
  void main() {
    v_uv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 u_res;
  uniform vec2 u_mouse;
  varying vec2 v_uv;

  void main() {
    vec2 uv = v_uv;
    float aspect = u_res.x / max(u_res.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);

    float d = distance(p, m);
    float pool = pow(max(0.0, 1.0 - d), 3.0);
    float core = pow(max(0.0, 1.0 - d * 2.4), 6.0);

    // near-black warm base, gold specular pool + hot core
    vec3 col = vec3(0.055, 0.047, 0.031);
    col += vec3(0.988, 0.749, 0.141) * pool * 0.50;
    col += vec3(1.0, 0.93, 0.78) * core * 0.85;

    // rim light on the pill edge, brighter where the pool is near
    vec2 b = min(uv, 1.0 - uv);
    float edge = min(b.x, b.y) * min(u_res.y, u_res.x);
    float rim = 1.0 - smoothstep(0.0, 2.5, edge);
    col += vec3(0.988, 0.749, 0.141) * rim * (0.55 + 0.45 * core);

    // gentle top-down sheen so the pill never reads flat
    col += vec3(0.05, 0.042, 0.028) * (1.0 - uv.y);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SpecularButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const wrapRef = useRef<HTMLAnchorElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");

    // Reduced motion: skip WebGL entirely; the CSS sheen on the wrapper is the
    // static fallback (see wrapper classes).
    if (reduced.matches) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        canvas,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        alpha: false,
        antialias: false,
      });
    } catch {
      // No WebGL — the CSS fallback stays visible.
      return;
    }
    const gl = renderer.gl;
    const scene = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          u_res: { value: new Vec2(1, 1) },
          u_mouse: { value: new Vec2(0.5, 1.35) },
        },
      }),
    });

    const mouse = { x: 0.5, y: 1.35, tx: 0.5, ty: 1.35 };
    let raf = 0;
    let running = false;
    let inView = true;
    const start = performance.now();

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height));
      (scene.program.uniforms.u_res.value as Vec2).set(
        gl.canvas.width,
        gl.canvas.height
      );
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      if (coarse.matches) {
        // Touch devices: self-sweeping light, no pointer tracking.
        const t = (now - start) / 1000;
        mouse.tx = 0.5 + 0.38 * Math.sin(t * 0.9);
        mouse.ty = 1.25 + 0.25 * Math.sin(t * 0.6 + 1.3);
      }
      // ease toward target, then park below the edge when idle
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      (scene.program.uniforms.u_mouse.value as Vec2).set(mouse.x, mouse.y);
      renderer.render({ scene });
    };
    const play = () => {
      if (!running && inView && !document.hidden) {
        running = true;
      }
    };
    const pause = () => {
      running = false;
    };

    const onMove = (e: PointerEvent) => {
      if (coarse.matches) return;
      const r = wrap.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / Math.max(1, r.width);
      mouse.ty = 1 - (e.clientY - r.top) / Math.max(1, r.height);
      play();
    };
    const onLeave = () => {
      mouse.tx = 0.5;
      mouse.ty = 1.35;
    };
    const onVis = () => {
      if (document.hidden) pause();
      else play();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = !!entry?.isIntersecting;
        if (inView) play();
        else pause();
      },
      { threshold: 0.01 }
    );

    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    io.observe(wrap);
    raf = requestAnimationFrame(frame);
    play();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  return (
    <a
      ref={wrapRef}
      href={href}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full shadow-[0_0_50px_-12px_rgba(245,158,11,0.45)] transition-shadow hover:shadow-[0_0_70px_-10px_rgba(245,158,11,0.65)] ${className}`}
    >
      {/* static CSS sheen: standalone fallback (reduced motion / no WebGL) */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_140%_at_50%_115%,rgba(251,191,36,0.55),rgba(251,191,36,0.08)_45%,rgba(0,0,0,0.92))]"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      <span className="relative z-10 inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
        {children}
      </span>
    </a>
  );
}

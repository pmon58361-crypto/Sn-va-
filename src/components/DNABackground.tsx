"use client";

import { useEffect, useRef } from "react";

/**
 * Partial DNA — the signature visual identity of Snívať.
 *
 * A field of vertical double-helix strands rendered to a single canvas.
 * Each strand is built from a parametric helix:
 *   - Rail A: x = axis + sin(t·k) · r
 *   - Rail B: x = axis + sin(t·k + π) · r   (opposite phase → crossing)
 * The two rails cross twice per twist, producing the classic helix silhouette.
 * Rungs connect matching t-values on both rails, forming the ladder.
 *
 * Strands float, breathe, and sway gently. The cursor bends nearby segments
 * via spring physics (jiggle, then settle). Small particles flow along the
 * rails to suggest "information flowing."
 *
 * Honors prefers-reduced-motion (renders one static frame) and pauses when
 * the tab is hidden. Targets 60 FPS.
 */

type RGB = [number, number, number];

// Soft, nature-inspired palettes. Each strand picks one. No rainbow.
const PALETTES: { a: RGB; b: RGB }[] = [
  { a: [107, 142, 78], b: [74, 141, 111] },    // moss → sage green
  { a: [201, 123, 58], b: [217, 154, 99] },    // terracotta → amber
  { a: [29, 53, 87], b: [90, 130, 184] },      // deep blue → sky
  { a: [45, 106, 79], b: [91, 168, 136] },     // forest → mint
  { a: [74, 85, 104], b: [120, 134, 150] },    // slate → fog
  { a: [140, 170, 100], b: [180, 200, 140] },  // olive → light moss
  { a: [200, 140, 90], b: [230, 190, 140] },   // sand → wheat
  { a: [85, 130, 110], b: [130, 175, 155] },   // pine → seafoam
];

type Segment = {
  // parametric position along strand (0..1 normalized then scaled)
  t: number;
  // rest (target) world coordinates of rail A and rail B nodes
  ax: number; ay: number;
  bx: number; by: number;
  // current (animated) coordinates — start at rest
  cax: number; cay: number;
  cbx: number; cby: number;
  // velocity for spring physics
  vax: number; vay: number; vbx: number; vby: number;
};

type Particle = {
  t: number;          // position along strand length (0..1)
  speed: number;      // units per second
  rail: "a" | "b";    // which rail
  life: number;       // 0..1
};

type Strand = {
  axisX: number;        // base x position
  topY: number;         // top of strand
  length: number;       // total vertical length
  segments: Segment[];  // sampled nodes
  particles: Particle[];
  palette: { a: RGB; b: RGB };
  radius: number;       // helix radius (px) — horizontal swing amplitude
  twist: number;        // twists over full length (e.g. 3 = 3 full turns)
  driftPhaseX: number;
  driftPhaseY: number;
  swayPhase: number;
  breathPhase: number;
};

// Calmed down from the original (7 strands, higher opacities) so the DNA
// reads as an intentional, subtle texture — not noisy filler.
const STRAND_COUNT = 4;
const SEGMENTS_PER_STRAND = 18;
const MOUSE_RADIUS = 130;
const MOUSE_FORCE = 0.6;
const SPRING = 0.05;
const FRICTION = 0.85;
const RAIL_OPACITY = 0.12;
const RUNG_OPACITY = 0.06;
const NODE_OPACITY = 0.28;
const PARTICLE_OPACITY = 0.3;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function buildStrand(width: number, height: number, index: number): Strand {
  const palette = PALETTES[index % PALETTES.length];
  const margin = width * 0.1;
  const axisX = margin + Math.random() * (width - margin * 2);
  const length = height * (0.5 + Math.random() * 0.4);
  const topY = Math.random() * (height - length) * 0.6;
  const radius = 22 + Math.random() * 18;
  const twist = 2.5 + Math.random() * 1.5;

  const segments: Segment[] = [];
  const samples = SEGMENTS_PER_STRAND;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;                      // 0..1
    const phase = t * twist * Math.PI * 2;       // total angle
    const y = topY + t * length;
    const ax = axisX + Math.sin(phase) * radius;
    const bx = axisX + Math.sin(phase + Math.PI) * radius;
    segments.push({
      t,
      ax, ay: y, bx, by: y,
      cax: ax, cay: y, cbx: bx, cby: y,
      vax: 0, vay: 0, vbx: 0, vby: 0,
    });
  }

  const particles: Particle[] = [];
  const pCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < pCount; i++) {
    particles.push({
      t: Math.random(),
      speed: (0.06 + Math.random() * 0.05) * (Math.random() < 0.5 ? 1 : -1),
      rail: Math.random() < 0.5 ? "a" : "b",
      life: 1,
    });
  }

  return {
    axisX,
    topY,
    length,
    segments,
    particles,
    palette,
    radius,
    twist,
    driftPhaseX: Math.random() * Math.PI * 2,
    driftPhaseY: Math.random() * Math.PI * 2,
    swayPhase: Math.random() * Math.PI * 2,
    breathPhase: Math.random() * Math.PI * 2,
  };
}

export function DNABackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true })!;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dpr = 1;
    let width = 0;
    let height = 0;
    let strands: Strand[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
    }

    function rebuild() {
      strands = [];
      for (let i = 0; i < STRAND_COUNT; i++) {
        strands.push(buildStrand(width, height, i));
      }
    }

    function onPointerMove(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }
    function onPointerLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }

    // Compute a segment's rest position for the current frame, including
    // drift (slow float), sway, and breathing radius modulation.
    function restPos(strand: Strand, seg: Segment, time: number) {
      const driftX = Math.sin(time * 0.00012 + strand.driftPhaseX) * 16;
      const driftY = Math.cos(time * 0.0001 + strand.driftPhaseY) * 11;
      const sway = Math.sin(time * 0.0004 + strand.swayPhase) * 5;
      const breath = 1 + Math.sin(time * 0.0008 + strand.breathPhase) * 0.05;
      const phase = seg.t * strand.twist * Math.PI * 2;
      const r = strand.radius * breath;
      return {
        ax: strand.axisX + driftX + sway + Math.sin(phase) * r,
        ay: seg.ay + driftY,
        bx: strand.axisX + driftX + sway + Math.sin(phase + Math.PI) * r,
        by: seg.by + driftY,
      };
    }

    function drawLine(
      x1: number, y1: number, x2: number, y2: number,
      color: string, width: number
    ) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function drawDot(x: number, y: number, color: string, radius: number) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    let raf = 0;
    let last = performance.now();
    let running = true;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min(now - last, 50);
      last = now;
      const time = now;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      for (const strand of strands) {
        // --- update rest positions + spring physics ---
        for (const seg of strand.segments) {
          const rest = restPos(strand, seg, time);
          seg.ax = rest.ax; seg.ay = rest.ay;
          seg.bx = rest.bx; seg.by = rest.by;

          // mouse repulsion on both rails
          if (mouse.active) {
            // Rail A
            const dax = seg.cax - mouse.x;
            const day = seg.cay - mouse.y;
            const daSq = dax * dax + day * day;
            if (daSq < MOUSE_RADIUS * MOUSE_RADIUS) {
              const d = Math.sqrt(daSq) || 1;
              const f = (1 - d / MOUSE_RADIUS) * MOUSE_FORCE * (dt / 16);
              seg.vax += (dax / d) * f * 14;
              seg.vay += (day / d) * f * 14;
            }
            // Rail B
            const dbx = seg.cbx - mouse.x;
            const dby = seg.cby - mouse.y;
            const dbSq = dbx * dbx + dby * dby;
            if (dbSq < MOUSE_RADIUS * MOUSE_RADIUS) {
              const d = Math.sqrt(dbSq) || 1;
              const f = (1 - d / MOUSE_RADIUS) * MOUSE_FORCE * (dt / 16);
              seg.vbx += (dbx / d) * f * 14;
              seg.vby += (dby / d) * f * 14;
            }
          }

          // spring toward rest
          seg.vax += (seg.ax - seg.cax) * SPRING;
          seg.vay += (seg.ay - seg.cay) * SPRING;
          seg.vbx += (seg.bx - seg.cbx) * SPRING;
          seg.vby += (seg.by - seg.cby) * SPRING;

          seg.vax *= FRICTION; seg.vay *= FRICTION;
          seg.vbx *= FRICTION; seg.vby *= FRICTION;

          seg.cax += seg.vax; seg.cay += seg.vay;
          seg.cbx += seg.vbx; seg.cby += seg.vby;
        }

        const cA = strand.palette.a;
        const cB = strand.palette.b;
        const colA = `rgba(${cA[0]},${cA[1]},${cA[2]},${RAIL_OPACITY})`;
        const colB = `rgba(${cB[0]},${cB[1]},${cB[2]},${RAIL_OPACITY})`;
        const rungA = `rgba(${cA[0]},${cA[1]},${cA[2]},${RUNG_OPACITY})`;
        const nodeA = `rgba(${cA[0]},${cA[1]},${cA[2]},${NODE_OPACITY})`;
        const nodeB = `rgba(${cB[0]},${cB[1]},${cB[2]},${NODE_OPACITY})`;

        // --- draw rungs (ladder) first, behind rails ---
        for (let i = 0; i < strand.segments.length; i++) {
          const s = strand.segments[i];
          drawLine(s.cax, s.cay, s.cbx, s.cby, rungA, 1);
        }

        // --- draw rail A (smooth curve) ---
        ctx.beginPath();
        ctx.strokeStyle = colA;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 0; i < strand.segments.length; i++) {
          const s = strand.segments[i];
          if (i === 0) ctx.moveTo(s.cax, s.cay);
          else {
            const prev = strand.segments[i - 1];
            const mx = (prev.cax + s.cax) / 2;
            const my = (prev.cay + s.cay) / 2;
            ctx.quadraticCurveTo(prev.cax, prev.cay, mx, my);
          }
        }
        ctx.stroke();

        // --- draw rail B (smooth curve) ---
        ctx.beginPath();
        ctx.strokeStyle = colB;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < strand.segments.length; i++) {
          const s = strand.segments[i];
          if (i === 0) ctx.moveTo(s.cbx, s.cby);
          else {
            const prev = strand.segments[i - 1];
            const mx = (prev.cbx + s.cbx) / 2;
            const my = (prev.cby + s.cby) / 2;
            ctx.quadraticCurveTo(prev.cbx, prev.cby, mx, my);
          }
        }
        ctx.stroke();

        // --- draw subtle nodes at crossings (small dots, not orbs) ---
        for (let i = 0; i < strand.segments.length; i += 2) {
          const s = strand.segments[i];
          drawDot(s.cax, s.cay, nodeA, 1.8);
          drawDot(s.cbx, s.cby, nodeB, 1.8);
        }

        // --- particles flowing along rails ---
        for (const p of strand.particles) {
          p.t += p.speed * (dt / 1000);
          if (p.t < 0) p.t += 1;
          if (p.t >= 1) p.t -= 1;

          // occasional split/merge: tiny chance to swap rails
          if (Math.random() < 0.002) {
            p.rail = p.rail === "a" ? "b" : "a";
          }

          const idxF = p.t * (strand.segments.length - 1);
          const i0 = Math.floor(idxF);
          const i1 = Math.min(i0 + 1, strand.segments.length - 1);
          const f = idxF - i0;
          const s0 = strand.segments[i0];
          const s1 = strand.segments[i1];
          if (p.rail === "a") {
            const px = lerp(s0.cax, s1.cax, f);
            const py = lerp(s0.cay, s1.cay, f);
            const col = strand.palette.a;
            drawDot(px, py, `rgba(${col[0]},${col[1]},${col[2]},${PARTICLE_OPACITY})`, 3);
            // soft glow halo
            drawDot(px, py, `rgba(${col[0]},${col[1]},${col[2]},0.12)`, 7);
          } else {
            const px = lerp(s0.cbx, s1.cbx, f);
            const py = lerp(s0.cby, s1.cby, f);
            const col = strand.palette.b;
            drawDot(px, py, `rgba(${col[0]},${col[1]},${col[2]},${PARTICLE_OPACITY})`, 3);
            drawDot(px, py, `rgba(${col[0]},${col[1]},${col[2]},0.12)`, 7);
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (prefersReduced) {
        frame(performance.now());
        running = false;
        return;
      }
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!prefersReduced) {
        start();
      }
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}

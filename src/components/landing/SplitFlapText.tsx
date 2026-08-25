"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SplitFlapText — Solari-board hero line. Cycles through `words`, flipping
 * each tile through junk chars left-to-right before it settles, exactly like
 * an airport departures board.
 *
 * - Unicode-safe: chars are code points, so "SNÍVAŤ" keeps its diacritics.
 * - padTo: words are padded with blank tiles to a fixed width (12 here) so
 *   the board never changes size between words.
 * - Reduced motion: tiles swap instantly, no spin, no per-tile timers.
 * - Mobile: tile size is em-based and scales down via the parent font size.
 */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZÁČĎÉÍĽŇÓŠŤÚÝŽ0123456789";
const SPIN_MS = 55;
const STAGGER_MS = 55;
const BASE_DELAY_MS = 120;

export function SplitFlapText({
  words,
  padTo = 0,
  loop = true,
  interval = 2600,
  tileColor = "#241b03",
  textColor = "#fcd34d",
  className = "",
}: {
  words: string[];
  padTo?: number;
  loop?: boolean;
  interval?: number;
  tileColor?: string;
  textColor?: string;
  className?: string;
}) {
  const [chars, setChars] = useState<string[]>(() =>
    padWord(words[0] ?? "", padTo)
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let wordIndex = 0;
    let cycle: ReturnType<typeof setInterval> | null = null;

    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const showWord = (word: string) => {
      const target = padWord(word, padTo);
      if (reduced.matches) {
        setChars(target);
        return;
      }
      target.forEach((ch, i) => {
        const settleAt = BASE_DELAY_MS + i * STAGGER_MS;
        const t1 = setTimeout(() => {
          const spin = setInterval(() => {
            setChars((prev) => {
              const next = [...prev];
              next[i] = CHARS[Math.floor(Math.random() * CHARS.length)];
              return next;
            });
          }, SPIN_MS);
          timers.current.push(spin as unknown as ReturnType<typeof setTimeout>);
          const t2 = setTimeout(() => {
            clearInterval(spin);
            setChars((prev) => {
              const next = [...prev];
              next[i] = ch;
              return next;
            });
          }, settleAt);
          timers.current.push(t2);
        }, 0);
        timers.current.push(t1);
      });
    };

    // First word is already displayed via initial state — start cycling after
    // one full interval. With loop=false the board stops on the last word.
    cycle = setInterval(() => {
      wordIndex += 1;
      if (wordIndex >= words.length) {
        if (!loop) {
          if (cycle) clearInterval(cycle);
          return;
        }
        wordIndex = 0;
      }
      clearTimers();
      showWord(words[wordIndex]);
    }, interval);

    return () => {
      if (cycle) clearInterval(cycle);
      clearTimers();
    };
  }, [words, padTo, interval, loop]);

  const width = Math.max(padTo, ...words.map((w) => [...w].length));

  return (
    <div
      className={`inline-flex items-center gap-[3px] font-mono text-sm sm:text-base ${className}`}
      aria-label={words[0] ?? ""}
      aria-live="off"
      data-flap-word={chars.join("")}
    >
      {Array.from({ length: width }, (_, i) => {
        const ch = chars[i] ?? " ";
        return (
          <span
            key={i}
            aria-hidden
            className="splitflap-tile inline-grid h-[1.5em] w-[1.2em] place-items-center rounded-[3px] font-bold leading-none"
            style={{
              backgroundColor: tileColor,
              color: ch === " " ? "transparent" : textColor,
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,0.07) 0 49.5%, rgba(0,0,0,0.4) 50% 100%)",
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.5)",
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        );
      })}
    </div>
  );
}

function padWord(word: string, padTo: number): string[] {
  const pts = Array.from(word);
  if (pts.length >= padTo) return pts;
  return [...pts, ...Array<string>(padTo - pts.length).fill(" ")];
}

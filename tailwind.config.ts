import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Channel-based vars (--x-rgb = "r g b") so Tailwind alpha
        // modifiers like bg-accent/10 generate real CSS.
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--bg-elevated-rgb) / <alpha-value>)",
        "surface-hover": "rgb(var(--bg-soft-rgb) / <alpha-value>)",
        soft: "rgb(var(--bg-soft-rgb) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
          faint: "rgb(var(--ink-faint-rgb) / <alpha-value>)",
          // Long-used-but-never-defined token (17 call sites); maps to muted.
          secondary: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--line-rgb) / <alpha-value>)",
          strong: "rgb(var(--line-strong-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          tint: "var(--accent-tint)",
          ink: "var(--accent-ink)",
        },
        warm: {
          DEFAULT: "rgb(var(--warm-rgb) / <alpha-value>)",
          tint: "var(--warm-tint)",
        },
        deep: "var(--deep)",
        slate2: "var(--slate)",
        moss: "var(--moss)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      maxWidth: {
        "8xl": "88rem",
      },
    },
  },
  plugins: [],
};

export default config;


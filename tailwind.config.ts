import type { Config } from "tailwindcss";

// Helper: produce a Tailwind color value that consumes a CSS variable
// holding space-separated RGB channels, so Tailwind's opacity modifiers
// (`bg-cream/50`) still work. Light defaults live in globals.css `:root`;
// dark overrides live under `[data-theme="dark"]`.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Theme is toggled via a data-theme="dark" attribute on <html>, set by
  // a small pre-hydration script in the root layout (see ThemeScript).
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: v("--color-cream"),
          deep: v("--color-cream-deep"),
        },
        ink: {
          DEFAULT: v("--color-ink"),
          soft: v("--color-ink-soft"),
          muted: v("--color-ink-muted"),
        },
        wine: {
          DEFAULT: v("--color-wine"),
          deep: v("--color-wine-deep"),
        },
        rule: v("--color-rule"),
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-newsreader)", "ui-serif", "Georgia", "serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        "display-2xl": ["4.5rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-xl": ["3.5rem", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-lg": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "display-sm": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "reading-lg": ["1.25rem", { lineHeight: "1.7" }],
        reading: ["1.125rem", { lineHeight: "1.7" }],
        "reading-sm": ["1rem", { lineHeight: "1.65" }],
        meta: ["0.8125rem", { lineHeight: "1.4", letterSpacing: "0.15em" }],
        "meta-sm": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.18em" }],
      },
      maxWidth: {
        prose: "65ch",
        reading: "36rem",
      },
    },
  },
  plugins: [],
};

export default config;

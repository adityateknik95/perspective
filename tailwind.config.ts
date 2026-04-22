import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F2EBDD",
          deep: "#E8DFCC",
        },
        ink: {
          DEFAULT: "#1A1512",
          soft: "#3A322C",
          muted: "#6B5E52",
        },
        wine: {
          DEFAULT: "#6B1F2B",
          deep: "#4A1520",
        },
        rule: "#C9BEA8",
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

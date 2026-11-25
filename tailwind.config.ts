import type { Config } from "tailwindcss";

const withAlpha = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: withAlpha("bg"),
        surface: withAlpha("surface"),
        fg: withAlpha("fg"),
        muted: withAlpha("muted"),
        line: withAlpha("line"),
        brand: withAlpha("brand"),
        brand2: withAlpha("brand2"),
        success: withAlpha("success"),
        warn: withAlpha("warn"),
        danger: withAlpha("danger"),
        violet: withAlpha("violet"),
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--brand) / 0.35), 0 8px 30px -8px rgb(var(--brand) / 0.55)",
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 10px 30px -12px rgb(0 0 0 / 0.35)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;

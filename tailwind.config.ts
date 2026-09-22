import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand: white, dark charcoal, muted olive.
        ink: {
          950: "#111213",
          900: "#18191B",
          800: "#232528",
          700: "#34373B",
          600: "#4A4E53",
          500: "#686C72",
          400: "#94989D",
          300: "#C4C7CA",
          200: "#E2E3E5",
          100: "#EFEFF0",
          50: "#F7F7F6",
        },
        olive: {
          950: "#1C2012",
          900: "#2A301C",
          800: "#394125",
          700: "#4A5430",
          600: "#5E6B3C",
          500: "#76844C",
          400: "#95A16A",
          300: "#B6BF92",
          200: "#D5DABE",
          100: "#EAEDDF",
          50: "#F5F6EF",
        },
        paper: "#FBFBF8",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,18,19,0.04), 0 1px 1px rgba(17,18,19,0.03)",
        lift: "0 10px 30px -12px rgba(17,18,19,0.18)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        pulseRing: { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.5)", opacity: "0" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        bar: { "0%,100%": { transform: "scaleY(0.4)" }, "50%": { transform: "scaleY(1)" } },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
        bar: "bar 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070B14",
          900: "#0B1220",
          800: "#111C2E",
          700: "#1E2C44",
          600: "#2B3D5C",
        },
        decision: {
          allow: "#16A34A",
          "allow-bg": "#DCFCE7",
          "allow-dark": "#052E16",
          review: "#D97706",
          "review-bg": "#FEF3C7",
          "review-dark": "#451A03",
          deny: "#DC2626",
          "deny-bg": "#FEE2E2",
          "deny-dark": "#450A0A",
        },
        brand: {
          blue: "#3B82F6",
          violet: "#8B5CF6",
          teal: "#0F766E",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

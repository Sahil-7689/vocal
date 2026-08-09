import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface": "#f9f9f9",
        "surface-dim": "#dadada",
        "surface-bright": "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#464554",
        "inverse-surface": "#2f3131",
        "inverse-on-surface": "#f0f1f1",
        "outline": "#767586",
        "outline-variant": "#c7c4d7",
        "surface-tint": "#494bd6",
        "primary": "#4648d4",
        "on-primary": "#ffffff",
        "primary-container": "#6063ee",
        "on-primary-container": "#fffbff",
        "inverse-primary": "#c0c1ff",
        "secondary": "#575e70",
        "on-secondary": "#ffffff",
        "secondary-container": "#d9dff5",
        "on-secondary-container": "#5c6274",
        "tertiary": "#904900",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#b55d00",
        "on-tertiary-container": "#fffbff",
        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "background": "#f9f9f9",
        "on-background": "#1a1c1c",
        "surface-variant": "#e2e2e2",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Geist", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      spacing: {
        "container-max": "1440px",
        gutter: "16px",
        "margin-page": "24px",
        "component-gap": "12px",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

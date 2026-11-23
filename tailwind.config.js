/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "Inter", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      colors: {
        bg:      "#07090e",
        surface: "rgba(255, 255, 255, 0.03)",
        card:    "rgba(255, 255, 255, 0.04)",
        border:  "rgba(255, 255, 255, 0.08)",
        muted:   "rgba(255, 255, 255, 0.55)",
        text:    "#ffffff",
        income:  "#34d399",
        expense: "#f87171",
        savings: "#06b6d4",
        accent:  "rgb(var(--acc-500) / <alpha-value>)",
        // Fondos casi negros del tema
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink2) / <alpha-value>)",
          3: "rgb(var(--ink3) / <alpha-value>)",
        },
        // El «cian» de la app es el acento del tema elegido (src/constants/themes.ts)
        cyan: Object.fromEntries(
          [100, 200, 300, 400, 500, 950].map((n) => [n, `rgb(var(--acc-${n}) / <alpha-value>)`])
        ),
      },
    },
  },
  plugins: [],
}

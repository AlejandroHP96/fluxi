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
        accent:  "#06b6d4", // Cian brillante moderno como en el video
      },
    },
  },
  plugins: [],
}

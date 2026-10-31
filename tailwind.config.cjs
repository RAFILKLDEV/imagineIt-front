module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08090D", card: "#11141B", surface: "#11141B", raised: "#191D27",
        accent: "#8264FF", aqua: "#55C7D8", gold: "#B49A69",
        line: "#292D38", ink: "#F2F3F7", muted: "#999EAD"
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"] },
      boxShadow: { panel: "0 10px 38px rgba(0,0,0,.14)" }
    }
  },
  plugins: []
};

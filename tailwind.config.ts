import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0F",
        panel: "#15151D",
        line: "#2A2A36",
        electric: "#7B61FF",
        neon: "#FF3CAC",
        cyan: "#00E5FF",
        lime: "#A3FF12",
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 32px rgb(123 97 255 / 24%)",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        secondary: "var(--secondary)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        main: "var(--main)",
      },
      backgroundImage: {
        "custom-gradient": "linear-gradient(0deg, #f5515f 0%, #9f041b 100%)",
        "hero-top":
          "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(251,251,251,0) 20%)",
        "hero-left":
          "linear-gradient(90deg, rgba(0,0,0,0.95) 15%, rgba(251,251,251,0) 45%)",
        "hero-bottom":
          "linear-gradient(0deg, #111319 10%, rgba(251,251,251,0) 60%)",
        "banner-gradient":
          "linear-gradient(65deg, rgba(0,0,0,0.95) 30%, rgba(210,24,24,0.7) 100%)",
      },
      borderRadius: {
        "custom-shape": "47% 53% 77% 23% / 36% 70% 30% 64%",
      },
    },
  },
  plugins: [],
};
export default config;

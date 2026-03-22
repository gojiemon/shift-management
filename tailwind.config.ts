import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "text-red-600", "text-red-400",
    "text-blue-600", "text-blue-400",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;

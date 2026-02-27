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
                foreground: "var(--foreground)",
                navy: {
                    DEFAULT: "#1a2744",
                    light: "#2d3f5e",
                },
                sand: {
                    DEFAULT: "#f5f0e8",
                    dark: "#e8e0d0",
                },
                sage: {
                    DEFAULT: "#3d8b6e",
                    light: "#e8f5ee",
                },
                amber: {
                    DEFAULT: "#c4882f",
                    light: "#fef3e2",
                },
                warmWhite: "#faf9f6",
                customRed: {
                    DEFAULT: "#c2453e",
                    light: "#fde8e7",
                },
            },
            fontFamily: {
                sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
                serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
            },
        },
    },
    plugins: [],
};
export default config;

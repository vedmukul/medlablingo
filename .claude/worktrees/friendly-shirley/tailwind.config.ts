import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            // ── Color Palette ─────────────────────────────────────
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",

                // Surfaces
                surface: {
                    DEFAULT: "#FAF8F5",
                    warm: "#F5F0EB",
                    card: "#FFFFFF",
                },

                // Primary accent — muted teal
                accent: {
                    DEFAULT: "#4A8B8C",
                    dark: "#3A7071",
                    light: "#E8F4F4",
                    muted: "#B8D8D8",
                },

                // Status indicators
                status: {
                    normal: "#48825B",
                    "normal-bg": "#EDF5F0",
                    caution: "#B7791F",
                    "caution-bg": "#FEF9EC",
                    critical: "#C53030",
                    "critical-bg": "#FEF2F2",
                },

                // Text
                text: {
                    primary: "#2D3748",
                    secondary: "#718096",
                    muted: "#A0AEC0",
                    inverse: "#FFFFFF",
                },
            },

            // ── Typography ────────────────────────────────────────
            fontFamily: {
                sans: [
                    "Source Sans 3",
                    "Source Sans Pro",
                    "Lato",
                    "system-ui",
                    "-apple-system",
                    "sans-serif",
                ],
            },

            fontSize: {
                "body-sm": ["0.875rem", { lineHeight: "1.5" }],
                body: ["1rem", { lineHeight: "1.625" }],
                "body-lg": ["1.125rem", { lineHeight: "1.625" }],
                heading: ["1.5rem", { lineHeight: "1.3" }],
                title: ["2rem", { lineHeight: "1.2" }],
            },

            // ── Spacing & Radius ──────────────────────────────────
            borderRadius: {
                card: "0.5rem",
                pill: "9999px",
            },

            // ── Shadows ───────────────────────────────────────────
            boxShadow: {
                card: "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
                "card-hover": "0 4px 12px rgba(0, 0, 0, 0.08)",
                sidebar: "2px 0 8px rgba(0, 0, 0, 0.04)",
            },
        },
    },
    plugins: [],
};
export default config;

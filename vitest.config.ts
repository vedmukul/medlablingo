import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        setupFiles: ["./tests/vitest-setup.ts"],
        include: ["tests/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/.claude/**"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});

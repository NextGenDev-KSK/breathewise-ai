import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // The real package throws outside a React Server environment.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**", "components/**", "hooks/**"],
      reporter: ["text-summary", "text"],
      // Enforced in CI: the build fails if coverage drops below these levels.
      thresholds: { statements: 90, lines: 90, functions: 85, branches: 78 },
    },
  },
});

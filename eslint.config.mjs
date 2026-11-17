import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react/no-danger": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Command-line scripts report progress on stdout.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
];
export default config;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/set-state-in-effect": "off",
      // Use lib/logger.ts for structured output; warn/error remain allowed.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  { files: ["lib/logger.ts"], rules: { "no-console": "off" } },
  globalIgnores([".next/**", "node_modules/**", "coverage/**", ".gemini/**", "playwright-report/**", "test-results/**"]),
]);

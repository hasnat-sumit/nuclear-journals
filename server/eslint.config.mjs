import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore marks a parameter that must exist but isn't used,
      // such as `next` in an Express error handler.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  globalIgnores(["dist/**"]),
]);

import { defineConfig } from "oxlint";
import { ignorePatterns } from "./oxfmt.config.ts";

export default defineConfig({
  ignorePatterns,
  rules: {
    "no-unused-vars": ["warn", {
      varsIgnorePattern: "^_",
      argsIgnorePattern: "^_",
      fix: { imports: "safe-fix" }
    }],
  },
});

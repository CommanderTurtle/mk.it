import { defineConfig } from "oxlint";
import { ignorePatterns } from "./oxfmt.config.ts";

export default defineConfig({
  ignorePatterns,
  categories: {
    correctness: "deny",
    suspicious: "deny",
  },
  rules: {
    "no-unused-vars": [
      "warn",
      {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_|^(inputFormat|outputFormat)$",
        fix: { imports: "safe-fix" },
      },
    ],
  },
});

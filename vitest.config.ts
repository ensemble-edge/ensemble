import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run tests from src/__tests__
    include: ["src/__tests__/**/*.test.ts"],
    // Explicitly exclude templates directory (bundled project files)
    exclude: ["templates/**", "node_modules/**"],
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/query/query-interpreter.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/query/query-interpreter.ts"],
      reporter: ["text", "json", "json-summary"],
      thresholds: {
        perFile: true,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});

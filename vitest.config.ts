import { defineConfig } from "vitest/config";
import path from "path";

process.env.JWT_SECRET = process.env.JWT_SECRET || "dummy-secret-for-tests-precommit";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "dummy-session-secret-for-tests";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "apps/api/**/*.test.ts",
      "packages/ai-extraction/**/*.test.ts",
      "packages/ai-review-ui/**/*.test.ts",
    ],
    // Stress/lifecycle sim uses an incomplete drizzle mock; not a unit gate (see ERP-000 lint baseline spirit).
    exclude: ["**/node_modules/**", "**/e2e-stress-simulation.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      // Scope coverage to the backend source the suite actually exercises.
      include: ["apps/api/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "apps/api/src/**/tests/**",
      ],
      // Ratchet floor: set just below today's numbers (stmts ~25.8%,
      // branches ~65%, funcs ~42.8%) so CI blocks regressions without
      // failing on day one. Raise these as coverage improves — never lower.
      thresholds: {
        statements: 24,
        branches: 60,
        functions: 40,
        lines: 24,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./apps/portal/src"),
      "@shared": path.resolve(import.meta.dirname, "./packages/shared-types"),
      "@server": path.resolve(import.meta.dirname, "./apps/api/src"),
      "@core": path.resolve(import.meta.dirname, "./apps/api/src/core"),
      "@modules": path.resolve(import.meta.dirname, "./apps/api/src/modules"),
      // Workspace packages ship a `dist` entry that isn't built in the test/CI
      // environment; resolve them to their TypeScript source instead.
      "@stockpro/ai-extraction": path.resolve(import.meta.dirname, "./packages/ai-extraction/src/index.ts"),
    },
  },
});

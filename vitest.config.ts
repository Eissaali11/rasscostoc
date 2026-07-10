import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/api/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./apps/portal/src"),
      "@shared": path.resolve(import.meta.dirname, "./packages/shared-types"),
      "@server": path.resolve(import.meta.dirname, "./apps/api/src"),
      "@core": path.resolve(import.meta.dirname, "./apps/api/src/core"),
      "@modules": path.resolve(import.meta.dirname, "./apps/api/src/modules"),
    },
  },
});

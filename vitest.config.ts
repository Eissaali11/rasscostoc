import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./client/src"),
      "@shared": path.resolve(import.meta.dirname, "./shared"),
      "@server": path.resolve(import.meta.dirname, "./server/src"),
      "@core": path.resolve(import.meta.dirname, "./server/src/core"),
      "@modules": path.resolve(import.meta.dirname, "./server/src/modules"),
    },
  },
});

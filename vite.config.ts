import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: [
      {
        find: "@stockpro/ai-review-ui/styles.css",
        replacement: path.resolve(
          import.meta.dirname,
          "packages/ai-review-ui/src/styles/workspace.css",
        ),
      },
      {
        find: "@stockpro/ai-review-ui",
        replacement: path.resolve(import.meta.dirname, "packages/ai-review-ui/src/index.ts"),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "apps/portal", "src") },
      { find: "@shared", replacement: path.resolve(import.meta.dirname, "packages/shared-types") },
      { find: "@assets", replacement: path.resolve(import.meta.dirname, "attached_assets") },
    ],
  },
  root: path.resolve(import.meta.dirname, "apps/portal"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      allow: [path.resolve(import.meta.dirname)],
      deny: ["**/.*"],
    },
  },
});

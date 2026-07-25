import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/fani-web/src"),
    },
  },
  root: path.resolve(import.meta.dirname, "apps/fani-web"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/fani-web"),
    emptyOutDir: true,
  },
  server: {
    port: 3002,
    proxy: {
      "/api": {
        target: "https://nuzum.fun",
        changeOrigin: true,
      },
    },
  },
});

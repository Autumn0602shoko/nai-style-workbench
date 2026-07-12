import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve("desktop"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve("desktop-dist/renderer"),
    emptyOutDir: true,
  },
});

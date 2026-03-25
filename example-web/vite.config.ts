import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-native-turbo-sqlite": path.resolve(repoRoot, "src/index.web.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "react-native-turbo-sqlite"],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});

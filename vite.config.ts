import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function spaFallback() {
  return {
    name: "spa-github-pages-fallback",
    closeBundle() {
      const index = resolve("dist/index.html");
      if (existsSync(index)) copyFileSync(index, resolve("dist/404.html"));
    },
  };
}

export default defineConfig({
  base: "/crankit/",
  plugins: [react(), spaFallback()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});

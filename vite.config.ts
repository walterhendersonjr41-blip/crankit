import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function spaFallback() {
  return {
    name: "spa-github-pages-fallback",
    closeBundle() {
      const index = resolve("dist/index.html");
      if (!existsSync(index)) return;
      copyFileSync(index, resolve("dist/404.html"));
      // A real folder so /crankit/privacy returns 200 (Pages' 404.html still uses status 404).
      const dir = resolve("dist/privacy");
      mkdirSync(dir, { recursive: true });
      copyFileSync(index, resolve(dir, "index.html"));
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

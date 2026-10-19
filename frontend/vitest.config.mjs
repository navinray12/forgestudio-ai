// Frontend regression tests (characterization + component tests). Tests live in tests/, outside
// src/, so they are not part of the app build (tsc -b / vite build).
//   npx vitest run --config vitest.config.mjs
// Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: true,
    environment: "node",
    // tests/website-editor mounts the full ~21k-line editor in jsdom. With the default worker count
    // (cores - 1) those files contend for CPU: their slowest tests went from ~25s alone to 60s+ in
    // parallel and timed out intermittently, while 4 workers ran without timeouts even under heavy
    // external load at a similar total duration. Bound concurrency instead of raising timeouts.
    maxWorkers: 4,
  },
});

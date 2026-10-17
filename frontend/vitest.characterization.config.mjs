// Characterization tests for editor modules that have no runtime dependencies.
// The frontend has no test tooling of its own yet, so this config deliberately imports nothing
// (no "vitest/config", no plugins) and can be run with any existing vitest install, e.g.:
//   cd backend && npx vitest run --config ../frontend/vitest.characterization.config.mjs
// Tests use vitest globals, live outside src/ and are not part of the app build (tsc -b / vite build).
import { fileURLToPath } from "node:url";

export default {
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    include: ["tests/characterization/**/*.test.ts"],
    globals: true,
    environment: "node",
  },
};

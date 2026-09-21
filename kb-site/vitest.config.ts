import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // real file I/O on temp dirs; generous so a loaded machine does not fail the run
    testTimeout: 30_000,
  },
});

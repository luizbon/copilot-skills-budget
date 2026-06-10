import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/release-smoke.test.ts"]
  }
});

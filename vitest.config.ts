import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/sdk/integration-*.test.ts"],
    exclude: ["test/release-smoke.test.ts"]
  }
});

import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/mongo-setup.mjs"],
    hookTimeout: 120000,
    testTimeout: 30000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 20_000,
    // Integration tests share the edugen_test database
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      MONGODB_URI: "mongodb://localhost:27017/edugen_test",
      QUEUE_PREFIX: "edugen-test",
    },
  },
});

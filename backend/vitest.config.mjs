import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js'],
    globalSetup: ['src/test-support/global-setup.mjs'],
    // Repository tests start an in-memory MongoDB replica set.
    hookTimeout: 120000,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      // Measure every source file, including ones no test imports yet.
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/test-support/**', 'src/seed/**'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 }
    }
  }
})

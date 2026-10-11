import { defineConfig } from 'vitest/config'

/**
 * `server.ts` only opens the port and wires signals; everything it starts is
 * built by `createApp`, which the tests drive through supertest.
 */
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/__tests__/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})

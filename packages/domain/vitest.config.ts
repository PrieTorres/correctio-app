import { defineConfig } from 'vitest/config'

/**
 * The schemas are the business rules both sides enforce, so they are measured
 * with the same threshold as the rest of the code.
 */
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})

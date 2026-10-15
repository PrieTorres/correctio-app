import { defineConfig } from 'vitest/config'

/**
 * Reading a sheet decides a grade, so it is measured with the same threshold as
 * the rest of the code (RNF08 names "leitura da folha" among the critical rules).
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

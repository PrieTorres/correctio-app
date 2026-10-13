import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/**
 * `DATABASE_TEST_URL` comes from `apps/api/.env` when it exists, so whoever works
 * on the API runs the schema test against the Docker MySQL. Without the file,
 * as for someone working only on the web app, that test is skipped locally; in
 * CI the variable is always set.
 */
if (existsSync('.env')) process.loadEnvFile('.env')

/**
 * `server.ts` only opens the port and wires signals, and `function.ts` only
 * hands requests to Firebase; everything both start is built by `bootstrapApi`,
 * which the tests drive through supertest. The migrations are DDL and the
 * migrate script a command line: the schema test runs them against a real
 * MySQL instead of measuring their lines.
 */
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/function.ts', 'src/db/migrate.ts', 'src/db/migrations/**', 'src/**/__tests__/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
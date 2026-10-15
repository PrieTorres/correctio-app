import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Locally the API answers at `/` on port 3000, while the web app calls `/api`,
 * as it does on Firebase, where Hosting forwards that path to the function.
 * The dev server and the preview Cypress runs against forward it the same way,
 * so the web app reaches the API on the same origin everywhere.
 */
const API_PROXY = {
  '/api': {
    target: 'http://localhost:3000',
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

/**
 * `base` is supplied by the deployment workflow: `/correctio-app/` on GitHub
 * Pages, `/` on Firebase Hosting. The router derives its basename from the
 * same value, so changing host never changes application code.
 *
 * The bundle targets ES2022, the same as the type check, so the entry can wait
 * for the demo seed with a top-level `await`; every browser that runs the app
 * today supports it (Chrome 89, Firefox 89, Safari 15).
 *
 * Coverage is scoped to business logic; screens are covered end to end by
 * Cypress, and measuring them here would dilute the threshold.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  build: { target: 'es2022' },
  plugins: [react(), tailwindcss()],
  server: { proxy: API_PROXY },
  preview: { proxy: API_PROXY },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    /**
     * A spy left behind by one test is a failure reported in another, far from
     * its cause. Restoring before each test keeps a suite from depending on the
     * order it happens to run in.
     */
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['./src/test-setup.ts'],
    /**
     * The repositories simulate latency on every call, and a test that walks a
     * whole flow makes a dozen of them. Five seconds is the default; these need
     * room without each one restating it.
     */
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/index.ts',
        'src/**/types.ts',
        'src/types/**',
        'src/main.tsx',
        'src/test-setup.ts',
        'src/test-utils.tsx',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },

    },
  },
})

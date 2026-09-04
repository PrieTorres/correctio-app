import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * `base` is supplied by the deployment workflow: `/correctio-app/` on GitHub
 * Pages, `/` on Firebase Hosting. The router derives its basename from the
 * same value, so changing host never changes application code.
 *
 * Coverage is scoped to business logic; screens are covered end to end by
 * Cypress, and measuring them here would dilute the threshold.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/index.ts',
        'src/**/types.ts',
        'src/types/**',
        'src/lib/seed/**',
        'src/main.tsx',
        'src/test-setup.ts',
        'src/test-utils.tsx',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },

    },
  },
})

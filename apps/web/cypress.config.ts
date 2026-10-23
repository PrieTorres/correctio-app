import { defineConfig } from 'cypress'

/**
 * Video stays off by default and is never set inside `e2e`: a value there wins
 * over `--config video=true`, which is how `test:e2e:journey` records the
 * evidence video. Compression keeps that recording small enough to download
 * from a pull request.
 */
export default defineConfig({
  projectId: 'eehvh8',
  videoCompression: 32,
  e2e: {
    baseUrl: 'http://localhost:4173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 800,
    testIsolation: false,
  },
})
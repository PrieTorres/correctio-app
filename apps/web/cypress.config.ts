import { defineConfig } from 'cypress'

/**
 * Video stays off by default and is never set inside `e2e`: a value there wins
 * over `--config video=true`, which is how `test:e2e:journey` records the
 * evidence video. Compression keeps that recording small enough to download
 * from a pull request.
 *
 * Cypress strips the page's CSP by default, which would let a CSP that breaks
 * the site pass every spec. `experimentalCspAllowList` keeps it, so the suite
 * runs under the same policy as production (`firebase.json`, served by the
 * preview).
 */
export default defineConfig({
  projectId: 'eehvh8',
  videoCompression: 32,
  experimentalCspAllowList: true,
  e2e: {
    baseUrl: 'http://localhost:4173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 800,
  },
})

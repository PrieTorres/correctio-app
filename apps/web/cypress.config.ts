import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: 'eehvh8',
  /**
   * Only `runMode` (the headless `cypress run` the CI gate uses) retries.
   * `openMode` stays at its default of zero, so a flake surfaces immediately
   * for whoever is watching it live instead of quietly passing on attempt two.
   */
  retries: { runMode: 2, openMode: 0 },
  e2e: {
    baseUrl: 'http://localhost:4173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 800,
  },
})

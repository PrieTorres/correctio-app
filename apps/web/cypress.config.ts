import { defineConfig } from 'cypress'
import { totpCodeForStep, totpStepAt } from '../api/src/lib/totp'

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
    /**
     * The browser cannot compute a TOTP code the way an authenticator app does,
     * so a task answers it in Node with the API's own implementation. A code
     * works once and each sign-in or confirmation needs a newer step, so the
     * caller asks for a step relative to now (`offset`): the server accepts one
     * step on each side, which gives three codes in a row without waiting.
     */
    setupNodeEvents(on) {
      on('task', {
        totpCode({ secret, offset = 0 }: { secret: string; offset?: number }) {
          return totpCodeForStep(secret, totpStepAt(Date.now()) + offset)
        },
      })
    },
  },
})

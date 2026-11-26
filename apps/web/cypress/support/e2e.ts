/**
 * Every test starts signed in as a teacher of its own, created on the API a
 * moment before and kept as `@teacher`, with the sample data written for that
 * teacher: no test sees what another one did, whatever the order. A spec about
 * being signed out clears the cookies first.
 *
 * The demo specs run against the Pages build, which has no API and signs its
 * own demo teacher in, so there they only start from an empty browser.
 */
import './commands'

/**
 * A resource the CSP blocks often fails without breaking the screen at once (a
 * font, a style), so a blocked one fails the test that loaded it instead of
 * reaching production unnoticed.
 */
Cypress.on('window:before:load', (win) => {
  win.document.addEventListener('securitypolicyviolation', (event) => {
    throw new Error(`The CSP blocked ${event.blockedURI || 'an inline resource'} (${event.violatedDirective})`)
  })
})

beforeEach(() => {
  cy.clearLocalStorage()
  cy.clearCookies()
  if (String(Cypress.env('DEMO_MODE')) !== 'true') cy.signInAsNewTeacher().as('teacher')
})

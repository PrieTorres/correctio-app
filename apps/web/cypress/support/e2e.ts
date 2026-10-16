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

beforeEach(() => {
  cy.clearLocalStorage()
  cy.clearCookies()
  if (String(Cypress.env('DEMO_MODE')) !== 'true') cy.signInAsNewTeacher().as('teacher')
})

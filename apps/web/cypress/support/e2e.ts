/**
 * The application seeds demo data on first load and keeps it in `localStorage`.
 * Clearing it before each test makes the suite order-independent.
 */
import './commands'

beforeEach(() => {
  cy.clearLocalStorage()
})

/**
 * Finds a form control by its visible label, falling back to the placeholder.
 *
 * Selecting by what the user sees keeps the tests from breaking on markup
 * changes, and fails when a field loses its accessible name.
 */
Cypress.Commands.add('findByLabelOrPlaceholder', (text: string) => {
  return cy.get('body').then(($body) => {
    const byLabel = $body.find(`label:contains("${text}")`)
    if (byLabel.length > 0) {
      const id = byLabel.attr('for')
      if (id !== undefined) return cy.get(`#${CSS.escape(id)}`)
    }
    return cy.get(`[placeholder="${text}"]`)
  })
})

/**
 * Scopes a query to the open dialog.
 *
 * A confirmation dialog usually repeats the label of the button that opened
 * it, and the original stays in the DOM behind the overlay. Without scoping,
 * the test picks the one the modal has made inert.
 */
Cypress.Commands.add('findInDialog', (selector: string, text: string) => {
  return cy.get('[role="dialog"]').should('be.visible').contains(selector, text)
})

declare global {
  namespace Cypress {
    interface Chainable {
      findByLabelOrPlaceholder(text: string): Chainable<JQuery<HTMLElement>>
      findInDialog(selector: string, text: string): Chainable<JQuery<HTMLElement>>
    }
  }
}

export {}

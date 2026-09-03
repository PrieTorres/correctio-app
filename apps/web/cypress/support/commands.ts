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

declare global {
  namespace Cypress {
    interface Chainable {
      findByLabelOrPlaceholder(text: string): Chainable<JQuery<HTMLElement>>
    }
  }
}

export {}

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

/**
 * Picks one option of a segmented control by its visible text.
 *
 * The control hides the radio with `sr-only` so the label can carry the
 * styling, which leaves the input with no size and covered by the fieldset:
 * `cy.check()` refuses it, and rightly so. Clicking the label is what a person
 * does, and the browser forwards it to the input.
 *
 * The assertion that follows is the point — it fails loudly if the label ever
 * stops being wired to its input, which no click alone would reveal.
 */
Cypress.Commands.add('chooseSegment', (text: string) => {
  cy.contains('label', text).click()
  return cy.contains('label', text).find('input[type="radio"]').should('be.checked')
})

declare global {
  namespace Cypress {
    interface Chainable {
      findByLabelOrPlaceholder(text: string): Chainable<JQuery<HTMLElement>>
      findInDialog(selector: string, text: string): Chainable<JQuery<HTMLElement>>
      chooseSegment(text: string): Chainable<JQuery<HTMLElement>>
    }
  }
}

export {}

import { writeDemoData } from '@/lib/seed'
import type { AuthenticatedUser } from '@/types/domain'

/** The password of every teacher the suite signs up; long enough for the 8-character rule. */
export const TEST_PASSWORD = 'senha-de-teste-1'

/** An address no earlier run used: the API keeps every account, and the same address twice is refused. */
export function uniqueEmail(prefix = 'prof'): string {
  return `${prefix}-${Date.now()}-${Cypress._.random(1e6)}@exemplo.edu.br`
}

/**
 * Signs a new teacher up on the API and leaves the browser signed in, the way
 * the app itself would: `cy.request` keeps the refresh cookie the API sets, and
 * the app restores the session from it on the next visit.
 *
 * The sample data is written to `localStorage` for this teacher, so every spec
 * starts from the same populated screens the demo shows, owned by a real
 * account. The screens whose data already lives on the API do not read it.
 */
Cypress.Commands.add('signInAsNewTeacher', ({ withSampleData = true }: { withSampleData?: boolean } = {}) => {
  const account = { fullName: 'Professora Ana Ribeiro', email: uniqueEmail(), password: TEST_PASSWORD }
  return cy.request('POST', '/api/auth/register', account).then(({ body }: Cypress.Response<{ user: AuthenticatedUser }>) => {
    if (withSampleData) writeDemoData(body.user.id)
    return { ...body.user, password: TEST_PASSWORD }
  })
})

/**
 * Finds a form control by its visible label.
 *
 * Selecting by what the user sees keeps the tests off markup details, and fails
 * loudly when a field loses the label that names it for a screen reader.
 *
 * `cy.contains` retries, which matters: reading the DOM once through
 * `cy.get('body').then(...)` does not, so on a screen still resolving its query
 * the form is simply not there yet and the command misses it.
 */
Cypress.Commands.add('findByLabel', (text: string) => {
  return cy.contains('label', text).then(($label) => {
    const id = $label.attr('for')
    if (id === undefined) throw new Error(`O label "${text}" não aponta para nenhum campo.`)
    return cy.get(`#${CSS.escape(id)}`)
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
      findByLabel(text: string): Chainable<JQuery<HTMLElement>>
      findInDialog(selector: string, text: string): Chainable<JQuery<HTMLElement>>
      chooseSegment(text: string): Chainable<JQuery<HTMLElement>>
      signInAsNewTeacher(options?: { withSampleData?: boolean }): Chainable<AuthenticatedUser & { password: string }>
    }
  }
}

export {}

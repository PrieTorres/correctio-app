import type { AuthenticatedUser } from '@/types/domain'
import type { QuestionInput } from '@/lib/schemas'

/** The password for every teacher created by the suite; long enough for the 8-character rule. */
export const TEST_PASSWORD = 'senha-de-teste-1'

/** An address that no previous run has used. */
export function uniqueEmail(prefix = 'prof'): string {
  return `${prefix}-${Date.now()}-${Cypress._.random(1e6)}@exemplo.edu.br`
}

/**
 * Registers a new teacher via the API and leaves the browser logged in.
 * The `cy.session` in `e2e.ts` stores cookies for subsequent tests.
 */
Cypress.Commands.add('signInAsNewTeacher', () => {
  const account = { fullName: 'Professora Ana Ribeiro', email: uniqueEmail(), password: TEST_PASSWORD }
  return cy.request('POST', '/api/auth/register', account).then(({ body }: Cypress.Response<{ user: AuthenticatedUser }>) => {
    return { ...body.user, password: TEST_PASSWORD }
  })
})

/**
 * Fetches the current token and creates a question in the API.
 */
Cypress.Commands.add('createQuestion', (question: QuestionInput) => {
  cy.request<{ accessToken: string }>('POST', '/api/auth/refresh').then((response) => {
    const token = response.body.accessToken
    cy.request({
      method: 'POST',
      url: '/api/questions',
      headers: { Authorization: `Bearer ${token}` },
      body: question,
    }).its('status').should('eq', 201)
  })
})

/**
 * Fetches the current token and creates an exam in the API.
 */
Cypress.Commands.add('createExam', (exam: Record<string, unknown>) => {
  cy.request<{ accessToken: string }>('POST', '/api/auth/refresh').then((response) => {
    const token = response.body.accessToken
    cy.request({
      method: 'POST',
      url: '/api/exams',
      headers: { Authorization: `Bearer ${token}` },
      body: exam,
    }).its('status').should('eq', 201)
  })
})

/**
 * Finds a form field by its visible label.
 */
Cypress.Commands.add('findByLabel', (text: string) => {
  return cy.contains('label', text).then(($label) => {
    const id = $label.attr('for')
    if (id === undefined) throw new Error(`The label "${text}" does not point to any field.`)
    return cy.get(`#${CSS.escape(id)}`)
  })
})

/**
 * Focuses the search inside the open dialog.
 */
Cypress.Commands.add('findInDialog', (selector: string, text: string) => {
  return cy.get('[role="dialog"]').should('be.visible').contains(selector, text)
})

/**
 * Selects an option from a segmented control by its visible text.
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
      signInAsNewTeacher(): Chainable<AuthenticatedUser & { password: string }>
      createQuestion(question: QuestionInput): Chainable<void>
      createExam(exam: Record<string, unknown>): Chainable<void>
    }
  }
}

export {}
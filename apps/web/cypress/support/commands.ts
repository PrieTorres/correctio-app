import type { AuthenticatedUser } from '@/types/domain'
import type { QuestionInput } from '@/lib/schemas'

/** A senha de todo professor que a suíte cadastra; longa o bastante para a regra de 8 caracteres. */
export const TEST_PASSWORD = 'senha-de-teste-1'

/** Um endereço que nenhuma execução anterior usou. */
export function uniqueEmail(prefix = 'prof'): string {
  return `${prefix}-${Date.now()}-${Cypress._.random(1e6)}@exemplo.edu.br`
}

/**
 * Cadastra um novo professor pela API e deixa o navegador logado.
 * O `cy.session` no `e2e.ts` guarda os cookies para os próximos testes.
 */
Cypress.Commands.add('signInAsNewTeacher', () => {
  const account = { fullName: 'Professora Ana Ribeiro', email: uniqueEmail(), password: TEST_PASSWORD }
  return cy.request('POST', '/api/auth/register', account).then(({ body }: Cypress.Response<{ user: AuthenticatedUser }>) => {
    return { ...body.user, password: TEST_PASSWORD }
  })
})

/**
 * Pega o token atual e cria uma questão na API.
 */
Cypress.Commands.add('createQuestion', (question: QuestionInput) => {
  cy.request('POST', '/api/auth/refresh').then((response) => {
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
 * Pega o token atual e cria uma prova na API.
 */
Cypress.Commands.add('createExam', (exam: Record<string, unknown>) => {
  cy.request('POST', '/api/auth/refresh').then((response) => {
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
 * Encontra um campo de formulário pelo seu rótulo visível.
 */
Cypress.Commands.add('findByLabel', (text: string) => {
  return cy.contains('label', text).then(($label) => {
    const id = $label.attr('for')
    if (id === undefined) throw new Error(`O label "${text}" não aponta para nenhum campo.`)
    return cy.get(`#${CSS.escape(id)}`)
  })
})

/**
 * Foca a busca dentro do diálogo aberto.
 */
Cypress.Commands.add('findInDialog', (selector: string, text: string) => {
  return cy.get('[role="dialog"]').should('be.visible').contains(selector, text)
})

/**
 * Escolhe uma opção de um controle segmentado pelo texto visível.
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
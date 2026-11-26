import type { SignedInTeacher } from '../support/commands'

/**
 * Optional second factor (security analysis, R2) against the API: turning it
 * on from the profile with a QR Code, signing in with the code, and turning it
 * off. The authenticator app is played by a task that computes the code in
 * Node from the secret the screen shows for typing.
 *
 * A code works once and every use needs a newer 30 s step than the last, so the
 * steps go in order: -1 to turn on, 0 to sign in, +1 to turn off. The server
 * accepts one step on each side of its own, which is what makes the three
 * available in the same half minute.
 */
const STEP = Object.freeze({ TURN_ON: -1, SIGN_IN: 0, TURN_OFF: 1 })

function codeFor(secret: string, offset: number): Cypress.Chainable<string> {
  return cy.task<string>('totpCode', { secret, offset })
}

function readSecret(): Cypress.Chainable<string> {
  return cy.get('[data-testid="totp-secret"]').invoke('text')
}

/** The profile screen's flow, ending with the section showing the factor as on. */
function turnOnFromProfile(): Cypress.Chainable<string> {
  cy.visit('/perfil')
  cy.contains('h2', 'Verificação em duas etapas').should('be.visible')
  cy.contains('button', 'Ativar verificação em duas etapas').click()

  cy.get('img[alt="QR Code para o aplicativo autenticador"]').should('be.visible')
  return readSecret().then((secret) => {
    codeFor(secret, STEP.TURN_ON).then((code) => {
      cy.findByLabel('Código de confirmação (6 dígitos)').type(code)
    })
    cy.contains('button', 'Confirmar e ativar').click()
    cy.contains('Ativada: ao entrar, o Correctio pede o código do aplicativo.').should('be.visible')
    return cy.wrap(secret)
  })
}

function signOutThroughApi(): void {
  cy.request('POST', '/api/auth/logout')
  cy.clearCookies()
}

function signInThroughForm({ email, password }: SignedInTeacher): void {
  cy.visit('/entrar')
  cy.findByLabel('E-mail').type(email)
  cy.findByLabel('Senha').type(password)
  cy.contains('button', /^Entrar$/).click()
}

describe('verificação em duas etapas', () => {
  it('liga no perfil, pede o código ao entrar e desliga com um código atual', () => {
    cy.get<SignedInTeacher>('@teacher').then((teacher) => {
      turnOnFromProfile().then((secret) => {
        signOutThroughApi()

        signInThroughForm(teacher)
        cy.contains('h1', 'Verificação em duas etapas').should('be.visible')
        cy.location('pathname').should('eq', '/entrar')
        codeFor(secret, STEP.SIGN_IN).then((code) => cy.findByLabel('Código do aplicativo (6 dígitos)').type(code))
        cy.contains('button', 'Verificar e entrar').click()
        cy.location('pathname').should('eq', '/painel')

        cy.visit('/perfil')
        cy.contains('p', 'Para desativar, digite o código atual do aplicativo.').should('be.visible')
        codeFor(secret, STEP.TURN_OFF).then((code) => cy.findByLabel('Código para desativar (6 dígitos)').type(code))
        cy.contains('button', 'Desativar verificação em duas etapas').click()
        cy.contains('button', 'Ativar verificação em duas etapas').should('be.visible')

        signOutThroughApi()
        signInThroughForm(teacher)
        cy.location('pathname').should('eq', '/painel')
      })
    })
  })

  it('recusa um código errado ao entrar e deixa tentar de novo', () => {
    cy.get<SignedInTeacher>('@teacher').then((teacher) => {
      turnOnFromProfile().then((secret) => {
        signOutThroughApi()

        signInThroughForm(teacher)
        cy.findByLabel('Código do aplicativo (6 dígitos)').type('000000')
        cy.contains('button', 'Verificar e entrar').click()
        cy.contains('[role="alert"]', 'Código incorreto ou já usado.').should('be.visible')
        cy.location('pathname').should('eq', '/entrar')

        codeFor(secret, STEP.SIGN_IN).then((code) => cy.findByLabel('Código do aplicativo (6 dígitos)').clear().type(code))
        cy.contains('button', 'Verificar e entrar').click()
        cy.location('pathname').should('eq', '/painel')
      })
    })
  })

  it('não aceita código que não tenha 6 números, sem chamar a API', () => {
    cy.get<SignedInTeacher>('@teacher').then((teacher) => {
      turnOnFromProfile().then(() => {
        signOutThroughApi()
        cy.intercept('POST', '/api/auth/login/totp').as('secondStep')

        signInThroughForm(teacher)
        cy.findByLabel('Código do aplicativo (6 dígitos)').type('12ab')
        cy.contains('button', 'Verificar e entrar').click()

        cy.contains('[role="alert"]', 'Digite os 6 números do código').should('be.visible')
        cy.get('@secondStep.all').should('have.length', 0)
      })
    })
  })

  it('o campo do código usa teclado numérico e o preenchimento de código de uso único', () => {
    cy.get<SignedInTeacher>('@teacher').then((teacher) => {
      turnOnFromProfile().then(() => {
        signOutThroughApi()
        signInThroughForm(teacher)

        cy.findByLabel('Código do aplicativo (6 dígitos)')
          .should('have.attr', 'inputmode', 'numeric')
          .and('have.attr', 'autocomplete', 'one-time-code')
          .invoke('outerHeight')
          .should('be.gte', 44)
        cy.contains('button', 'Voltar').click()
        cy.contains('h1', 'Entrar').should('be.visible')
      })
    })
  })

  it('a API só entrega a sessão depois do código, mesmo com a senha certa', () => {
    cy.get<SignedInTeacher>('@teacher').then((teacher) => {
      turnOnFromProfile().then(() => {
        signOutThroughApi()

        cy.request('POST', '/api/auth/login', { email: teacher.email, password: teacher.password }).then(({ body }) => {
          expect(body).to.include({ secondFactorRequired: true })
          expect(body).not.to.have.property('accessToken')
        })
        cy.getCookie('__session').should('not.exist')
      })
    })
  })
})

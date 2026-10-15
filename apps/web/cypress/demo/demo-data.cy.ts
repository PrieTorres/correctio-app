/**
 * The demo controls of the GitHub Pages build (`VITE_DEMO_MODE`), run against
 * that build by `npm run test:e2e:demo`.
 *
 * They exist only there, but the demo is what the client and the professor use
 * to look around, so a break here is visible to exactly the people the
 * delivery is for.
 */
describe('dados de demonstração', () => {
  beforeEach(() => cy.visit('/turmas'))

  it('parte com o sistema povoado', () => {
    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  it('limpa os dados e revela o estado vazio', () => {
    cy.contains('button', 'Limpar').click()

    cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')
    cy.contains('Cálculo I — Noturno').should('not.exist')
  })

  it('devolve os dados ao aplicar de novo', () => {
    cy.contains('button', 'Limpar').click()
    cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')

    cy.contains('button', 'Aplicar').click()

    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  it('desabilita a ação que não faz sentido no estado atual', () => {
    cy.contains('button', 'Aplicar').should('be.disabled')

    cy.contains('button', 'Limpar').click()

    cy.contains('button', 'Limpar').should('be.disabled')
    cy.contains('button', 'Aplicar').should('be.enabled')
  })

  it('mantém a tela vazia depois de recarregar', () => {
    cy.contains('button', 'Limpar').click()
    cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')

    cy.reload()

    cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')
  })
})

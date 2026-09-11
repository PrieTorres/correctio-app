/**
 * Sign in and sign up are simulated: any e-mail and password combination
 * succeeds, since there is no backend yet. This covers the flow and the
 * navigation it unlocks, not credential checking.
 */
describe('autenticação', () => {
  it('cria uma conta e vai para o painel', () => {
    cy.visit('/criar-conta')

    cy.findByLabelOrPlaceholder('Nome completo').type('Ana Ribeiro')
    cy.findByLabelOrPlaceholder('E-mail').type('ana.ribeiro@exemplo.edu.br')
    cy.findByLabelOrPlaceholder('Senha').type('senha123')
    cy.findByLabelOrPlaceholder('Confirmar senha').type('senha123')
    cy.contains('button', 'Criar conta').click()

    cy.location('pathname').should('eq', '/painel')
  })

  it('avisa quando a confirmação de senha não bate', () => {
    cy.visit('/criar-conta')

    cy.findByLabelOrPlaceholder('Nome completo').type('Ana Ribeiro')
    cy.findByLabelOrPlaceholder('E-mail').type('ana.ribeiro@exemplo.edu.br')
    cy.findByLabelOrPlaceholder('Senha').type('senha123')
    cy.findByLabelOrPlaceholder('Confirmar senha').type('outrasenha')
    cy.contains('button', 'Criar conta').click()

    cy.contains('As senhas não coincidem').should('be.visible')
    cy.location('pathname').should('eq', '/criar-conta')
  })

  it('faz login e vai para o painel', () => {
    cy.visit('/entrar')

    cy.findByLabelOrPlaceholder('E-mail').type('ana.ribeiro@exemplo.edu.br')
    cy.findByLabelOrPlaceholder('Senha').type('senha123')
    cy.contains('button', 'Entrar').click()

    cy.location('pathname').should('eq', '/painel')
  })

  it('navega entre a tela de login e a de cadastro', () => {
    cy.visit('/entrar')

    cy.contains('a', 'Criar conta').click()
    cy.location('pathname').should('eq', '/criar-conta')

    cy.contains('a', 'Entrar').click()
    cy.location('pathname').should('eq', '/entrar')
  })

  it('sai da conta e volta para a tela de login', () => {
    cy.visit('/entrar')
    cy.findByLabelOrPlaceholder('E-mail').type('ana.ribeiro@exemplo.edu.br')
    cy.findByLabelOrPlaceholder('Senha').type('senha123')
    cy.contains('button', 'Entrar').click()
    cy.location('pathname').should('eq', '/painel')

    cy.contains('button', 'Sair').click()

    cy.location('pathname').should('eq', '/entrar')
  })
})

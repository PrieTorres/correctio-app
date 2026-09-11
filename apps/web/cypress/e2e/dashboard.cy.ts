/**
 * The dashboard is the screen right after sign-in, so it reads whatever is
 * real today (classes, exams) and is honest about what is not built yet
 * (applications and pending corrections show zero and still navigate).
 */
describe('painel', () => {
  beforeEach(() => cy.visit('/painel'))

  it('greets the teacher and summarizes the seeded classes and exams', () => {
    cy.contains('h1', 'Olá').should('be.visible')
    cy.get('main').contains('Turmas ativas').closest('a').contains('3').should('be.visible')
    cy.get('main').contains('Provas').closest('a').contains('3').should('be.visible')
  })

  it('shows zero for the screens that are not built yet, without hiding them', () => {
    cy.get('main').contains('Aplicações').closest('a').contains('0').should('be.visible')
    cy.get('main').contains('Correções pendentes').closest('a').contains('0').should('be.visible')
  })

  it('lists the seeded recent activity, most recent first', () => {
    cy.contains('h2', 'Atividade recente').should('be.visible')
    cy.contains('li', 'produto escalar').should('be.visible')
  })

  it('takes each shortcut to where it promises', () => {
    cy.contains('button', 'Nova turma').click()
    cy.location('pathname').should('eq', '/turmas')

    cy.visit('/painel')
    cy.contains('button', 'Nova prova').click()
    cy.location('pathname').should('eq', '/provas/nova')

    cy.visit('/painel')
    cy.contains('button', 'Nova aplicação').click()
    cy.location('pathname').should('eq', '/aplicacoes/nova')

    cy.visit('/painel')
    cy.contains('button', 'Corrigir provas').click()
    cy.location('pathname').should('eq', '/aplicacoes')
  })

  it('takes the summary cards to their own screens', () => {
    cy.get('main').contains('a', 'Turmas ativas').click()
    cy.location('pathname').should('eq', '/turmas')
  })

  it('greets the teacher by the first name once signed in', () => {
    cy.visit('/criar-conta')
    cy.contains('h1', 'Criar conta').should('be.visible')

    cy.findByLabel('Nome completo').type('Ana Ribeiro')
    cy.findByLabel('E-mail').type('ana.ribeiro@exemplo.edu.br')
    cy.findByLabel('Senha').type('senha123')
    cy.findByLabel('Confirmar senha').type('senha123')
    cy.contains('button', 'Criar conta').click()

    cy.contains('h1', 'Olá, Ana!').should('be.visible')
  })
})

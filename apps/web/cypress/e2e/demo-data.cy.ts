/**
 * The demo controls and the empty states they reveal.
 *
 * These only exist while the app runs on mock data, but they are what the
 * client and the professor use to look around, so a break here is visible to
 * exactly the people the delivery is for.
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

describe('estados vazios', () => {
  beforeEach(() => cy.visit('/turmas'))

  it('explica o que é uma turma quando não existe nenhuma', () => {
    cy.contains('button', 'Limpar').click()

    cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')
    cy.contains('Turma é onde ficam seus alunos').should('be.visible')
    cy.contains('button', 'Nova turma').should('be.visible')
  })

  it('distingue busca sem resultado de sistema vazio', () => {
    cy.get('input[type="search"]').type('zzzz')

    cy.contains('h3', 'Nenhuma turma encontrada').should('be.visible')
    cy.contains('button', 'Limpar busca').should('be.visible')
    
    cy.contains('h3', 'Nenhuma turma ainda').should('not.exist')
  })

  it('volta à lista ao limpar a busca pelo próprio estado vazio', () => {
    cy.get('input[type="search"]').type('zzzz')
    cy.contains('button', 'Limpar busca').click()

    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  it('explica que arquivar não apaga', () => {
    cy.findByRadioLabel('Arquivadas').check()
    cy.contains('Cálculo I — Matutino').should('be.visible')

    cy.contains('button', 'Limpar').click()

    cy.contains('h3', 'Nenhuma turma arquivada').should('be.visible')
    cy.contains('continua nos relatórios').should('be.visible')
  })

  it('mostra a ilustração como decorativa, fora da árvore de acessibilidade', () => {
    cy.contains('button', 'Limpar').click()

    cy.get('svg[aria-hidden="true"]').should('exist')
  })
})

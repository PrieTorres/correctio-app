/**
 * What a teacher with nothing yet sees, and what an empty search shows. A
 * teacher without sample data stands for the empty system.
 */
describe('estados vazios', () => {
  beforeEach(() => cy.visit('/turmas'))

  /** Signs out of the populated teacher of the support file and in as one who has nothing. */
  function startWithoutData(): void {
    cy.clearCookies()
    cy.signInAsNewTeacher({ withSampleData: false })
    cy.visit('/turmas')
  }

  it('explica o que é uma turma quando não existe nenhuma', () => {
    startWithoutData()

    cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')
    cy.contains('Turma é onde ficam seus alunos').should('be.visible')
    cy.contains('button', 'Nova turma').should('be.visible')
  })

  it('distingue busca sem resultado de sistema vazio', () => {
    cy.get('[aria-label="Buscar turmas"]').type('zzzz')

    cy.contains('h3', 'Nenhuma turma encontrada').should('be.visible')
    cy.contains('button', 'Limpar busca').should('be.visible')
    
    cy.contains('h3', 'Nenhuma turma ainda').should('not.exist')
  })

  it('volta à lista ao limpar a busca pelo próprio estado vazio', () => {
    cy.get('[aria-label="Buscar turmas"]').type('zzzz')
    cy.contains('button', 'Limpar busca').click()

    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  it('explica que arquivar não apaga', () => {
    cy.chooseSegment('Arquivadas')
    cy.contains('Cálculo I — Matutino').should('be.visible')

    startWithoutData()
    cy.chooseSegment('Arquivadas')

    cy.contains('h3', 'Nenhuma turma arquivada').should('be.visible')
    cy.contains('continua nos relatórios').should('be.visible')
  })

  it('mostra a ilustração como decorativa, fora da árvore de acessibilidade', () => {
    startWithoutData()

    cy.get('svg[aria-hidden="true"]').should('exist')
  })
})

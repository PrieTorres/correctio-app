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

/**
 * The other two states a screen can be in. Loading is an animation in the
 * middle of the page, its sentence left to screen readers; a failure explains
 * itself and offers to try again, which here brings the list back.
 */
describe('carregando e erro', () => {
  it('mostra uma animação, e não um texto, enquanto a lista carrega', () => {
    cy.intercept({ method: 'GET', pathname: '/api/classes' }, (req) => {
      req.on('response', (res) => {
        res.setDelay(1500)
      })
    })
    cy.visit('/turmas')

    cy.get('[role="status"]').should('contain', 'Carregando')
    cy.contains('Carregando').should('not.be.visible')
    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  /** Two failures, because a failed read is tried once more on its own before the screen gives up. */
  it('explica o erro e tenta de novo pelo botão', () => {
    cy.intercept({ method: 'GET', pathname: '/api/classes', times: 2 }, { statusCode: 500, body: { code: 'FAILURE', message: 'Erro inesperado.' } })
    cy.visit('/turmas')

    cy.contains('[role="alert"]', 'Não foi possível carregar os dados', { timeout: 20000 }).should('be.visible')
    cy.contains('button', 'Tentar de novo').click()

    cy.contains('Cálculo I — Noturno').should('be.visible')
    cy.get('[role="alert"]').should('not.exist')
  })
})

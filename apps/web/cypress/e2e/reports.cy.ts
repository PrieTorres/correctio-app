/**
 * The consolidated report (P19) and its filters.
 *
 * Two applications are corrected so there is something to tell apart: the
 * calculus midterm (a maths class, term 2026/2, on 2026-10-05) and the physics
 * quiz (a physics class, term 2026/2, on 2026-11-12). The sample data has no
 * corrections of its own.
 */
const CALCULUS = 'Cálculo I — Prova 1'
const PHYSICS = 'Física II — Teste rápido'

function correctBoth(): void {
  cy.correctFirstSheetOf(CALCULUS)
  cy.generateApplication(PHYSICS)
  cy.correctFirstSheetOf(PHYSICS)
  cy.get('[aria-label="Navegação principal"]').contains('a', 'Relatórios').click()
  cy.contains('h1', 'Relatório consolidado').should('be.visible')
  cy.contains('a', CALCULUS).should('be.visible')
  cy.contains('a', PHYSICS).should('be.visible')
}

describe('relatório consolidado', () => {
  it('explica que nada foi corrigido e não oferece filtros sem linhas', () => {
    cy.visit('/relatorios')

    cy.contains('Nenhuma aplicação corrigida').should('be.visible')
    cy.get('form[aria-label="Filtros do relatório"]').should('not.exist')
  })
})

describe('relatório consolidado: filtros', () => {
  beforeEach(correctBoth)

  it('filtra por turma', () => {
    cy.findByLabel('Turma').select('Física II')

    cy.contains('a', PHYSICS).should('be.visible')
    cy.contains('a', CALCULUS).should('not.exist')
  })

  it('filtra por disciplina', () => {
    cy.findByLabel('Disciplina').select('Matemática')

    cy.contains('a', CALCULUS).should('be.visible')
    cy.contains('a', PHYSICS).should('not.exist')
  })

  it('só oferece períodos e disciplinas que existem no relatório', () => {
    cy.findByLabel('Período').find('option').then(($options) => {
      expect([...$options].map((option) => option.textContent)).to.deep.equal(['Todas', '2026/2'])
    })
    cy.findByLabel('Disciplina').find('option').then(($options) => {
      expect([...$options].map((option) => option.textContent)).to.deep.equal(['Todas', 'Física', 'Matemática'])
    })
  })

  it('filtra por período', () => {
    cy.findByLabel('Período').select('2026/2')

    cy.contains('a', CALCULUS).should('be.visible')
    cy.contains('a', PHYSICS).should('be.visible')
  })

  it('filtra pelo intervalo de datas, com as duas pontas incluídas', () => {
    cy.findByLabel('De').type('2026-10-05')
    cy.findByLabel('Até').type('2026-10-05')

    cy.contains('a', CALCULUS).should('be.visible')
    cy.contains('a', PHYSICS).should('not.exist')
  })

  it('aceita um intervalo aberto de um lado', () => {
    cy.findByLabel('De').type('2026-11-01')

    cy.contains('a', PHYSICS).should('be.visible')
    cy.contains('a', CALCULUS).should('not.exist')
  })

  it('combina os filtros', () => {
    cy.findByLabel('Disciplina').select('Matemática')
    cy.findByLabel('De').type('2026-11-01')

    cy.contains('Nenhuma aplicação nesse filtro').should('be.visible')
  })

  it('guarda os filtros na URL e os mantém ao recarregar', () => {
    cy.findByLabel('Disciplina').select('Física')
    cy.location('search').should('contain', 'subject=')
    cy.contains('a', CALCULUS).should('not.exist')

    cy.reload()

    cy.findByLabel('Disciplina').should('contain.text', 'Física')
    cy.findByLabel('Disciplina').find('option:selected').should('have.text', 'Física')
    cy.contains('a', PHYSICS).should('be.visible')
    cy.contains('a', CALCULUS).should('not.exist')
  })

  it('volta a todas as aplicações ao limpar os filtros', () => {
    cy.findByLabel('Disciplina').select('Física')
    cy.contains('a', CALCULUS).should('not.exist')

    cy.contains('button', 'Limpar filtros').click()

    cy.contains('a', CALCULUS).should('be.visible')
    cy.contains('a', PHYSICS).should('be.visible')
    cy.contains('button', 'Limpar filtros').should('not.exist')
    cy.location('search').should('eq', '')
  })

  /** Each row's figures come from its own scores, and only the rows that survive the filter are drawn. */
  it('mostra só as linhas que passam pelo filtro', () => {
    cy.get('tbody tr').should('have.length', 2)

    cy.findByLabel('Turma').select('Física II')

    cy.get('tbody tr').should('have.length', 1)
    cy.contains('tr', PHYSICS).should('contain', 'Física II')
  })
})

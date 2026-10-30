import { printForTheTeacher } from '../support/commands'

/**
 * The consolidated report (P19) and its filters.
 *
 * Two applications are corrected so there is something to tell apart: the
 * calculus midterm (a maths class, term 2026/2, on 2026-10-05) and the physics
 * quiz (a physics class, term 2026/2, on 2026-11-12). The sample data has no
 * corrections of its own, and the report is calculated on the API (#50), so
 * the corrections are written there, finished, with every answer right.
 */
const CALCULUS = 'Cálculo I — Prova 1'
const PHYSICS = 'Física II — Teste rápido'

function correctBoth(): void {
  cy.gradeFirstSheetOf(CALCULUS)
  cy.gradeFirstSheetOf(PHYSICS)
  cy.visit('/relatorios')
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

  /** Requirements, section 5: a correction without every open-ended score has no grade to compare yet. */
  it('deixa de fora a aplicação que só tem correção em andamento', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [], finalize: false })
    })
    cy.visit('/relatorios')

    cy.contains('Nenhuma aplicação corrigida').should('be.visible')
  })

  /** Every number of a row comes from the server, from the finished corrections, with the full grade here. */
  it('mostra os números de cada aplicação corrigida e leva ao relatório dela', () => {
    correctBoth()

    cy.contains('tr', CALCULUS).within(() => {
      cy.get('td').eq(3).should('have.text', '1')
    })
    cy.contains('a', PHYSICS).click()

    cy.contains('h1', 'Relatório da aplicação').should('be.visible')
    cy.contains(PHYSICS).should('be.visible')
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

  /** RF36: the file holds the rows on screen, so the filters go along with the export. */
  it('exporta em Excel só as linhas do filtro e baixa o arquivo pelo aviso', () => {
    cy.findByLabel('Turma').select('Física II')
    cy.intercept({ method: 'GET', pathname: '/api/reports/consolidated', query: { format: 'xlsx' } }).as('export')

    cy.contains('button', 'Exportar Excel').click()

    cy.wait('@export').then(({ request, response }) => {
      expect(request.url).to.contain('class=')
      expect(response?.headers['content-type']).to.contain('spreadsheetml')
    })
    cy.contains('[role="status"]', 'Relatório consolidado em Excel: pronto.').within(() => {
      cy.contains('button', /^Baixar relatorio-consolidado-\d{4}-\d{2}-\d{2}\.xlsx$/).click()
    })
  })

  /** Each row's figures come from its own scores, and only the rows that survive the filter are drawn. */
  it('mostra só as linhas que passam pelo filtro', () => {
    cy.get('tbody tr').should('have.length', 2)

    cy.findByLabel('Turma').select('Física II')

    cy.get('tbody tr').should('have.length', 1)
    cy.contains('tr', PHYSICS).should('contain', 'Física II')
  })
})

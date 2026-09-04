/**
 * Smoke test for the only flow that is fully built.
 *
 * It exercises the whole stack end to end: routing, the query cache, the
 * repository layer and `localStorage` persistence.
 */
describe('turmas', () => {
  it('lista as turmas semeadas', () => {
    cy.visit('/turmas')

    cy.contains('h1', 'Turmas').should('be.visible')
    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  it('cria uma turma e mostra na lista', () => {
    cy.visit('/turmas')

    cy.contains('button', 'Nova turma').click()
    cy.findByLabelOrPlaceholder('Nome da turma').type('Estatística I')
    cy.findByLabelOrPlaceholder('Disciplina').type('Matemática')
    cy.findByLabelOrPlaceholder('Período').type('2026/2')
    cy.contains('button', 'Salvar').click()

    cy.contains('Estatística I').should('be.visible')
  })

  it('arquiva uma turma e a encontra no filtro de arquivadas', () => {
    cy.visit('/turmas')

    cy.contains('Física II')
      .closest('li')
      .within(() => {
        cy.contains('button', 'Arquivar').click()
      })

    cy.findInDialog('button', 'Arquivar').click()

    cy.contains('Física II').should('not.exist')

    cy.contains('button', 'Arquivadas').click()
    cy.contains('Física II').should('be.visible')
  })

  it('abre o detalhe da turma e lista os alunos', () => {
    cy.visit('/turmas')

    cy.contains('a', 'Cálculo I — Noturno').click()

    cy.contains('h1', 'Cálculo I — Noturno').should('be.visible')
    cy.contains('Ana Beatriz Moreira').should('be.visible')
  })

  it('anonimiza um aluno preservando o registro', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Cálculo I — Noturno').click()

    cy.contains('li', 'Ana Beatriz Moreira').within(() => {
      cy.contains('button', 'Anonimizar').click()
    })
    cy.findInDialog('button', 'Anonimizar').click()

    cy.contains('Ana Beatriz Moreira').should('not.exist')
    cy.contains('Aluno anonimizado').should('be.visible')
  })
})

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
    cy.findByLabel('Nome da turma').type('Estatística I')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2026/2')
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

    cy.chooseSegment('Arquivadas')
    cy.contains('Física II').should('be.visible')
  })

  it('abre o detalhe da turma e lista os alunos', () => {
    cy.visit('/turmas')

    cy.contains('a', 'Cálculo I — Noturno').click()

    cy.contains('h1', 'Cálculo I — Noturno').should('be.visible')
    cy.contains('Ana Beatriz Moreira').should('be.visible')
  })

  it('cadastra um aluno sem e-mail, porque o campo é opcional', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Cálculo I — Noturno').click()

    cy.contains('button', 'Adicionar aluno').click()
    cy.findByLabel('Nome completo').type('Rafael Nunes')
    cy.findByLabel('Matrícula').type('2026099')
    cy.findInDialog('button', 'Adicionar').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('li', 'Rafael Nunes').should('be.visible')
  })

  it('recusa um e-mail malformado, que é diferente de não informar', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Cálculo I — Noturno').click()

    cy.contains('button', 'Adicionar aluno').click()
    cy.findByLabel('Nome completo').type('Rafael Nunes')
    cy.findByLabel('Matrícula').type('2026099')
    cy.findByLabel('E-mail (opcional)').type('rafael@')
    cy.findInDialog('button', 'Adicionar').click()

    cy.contains('E-mail inválido').should('be.visible')
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

describe('turmas duplicadas', () => {
  beforeEach(() => cy.visit('/turmas'))

  it('recusa uma turma com os mesmos dados de outra', () => {
    cy.contains('button', 'Nova turma').click()
    cy.findByLabel('Nome da turma').type('Cálculo I — Noturno')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2026/2')
    cy.findInDialog('button', 'Salvar').click()

    cy.contains('Já existe uma turma com estes dados').should('be.visible')
  })

  it('aceita o mesmo nome em outro período, que é o semestre seguinte', () => {
    cy.contains('button', 'Nova turma').click()
    cy.findByLabel('Nome da turma').type('Cálculo I — Noturno')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2027/1')
    cy.findInDialog('button', 'Salvar').click()

    cy.get('[role="dialog"]').should('not.exist')
  })

  it('busca por nome e por disciplina sem acento', () => {
    cy.get('input[type="search"]').type('calculo')
    cy.contains('Cálculo I — Noturno').should('be.visible')

    cy.get('input[type="search"]').clear().type('matematica')
    cy.contains('Cálculo I — Noturno').should('be.visible')
  })
})

/**
 * #145: on a phone every control is 44 px tall (RNF11), and a button repeated
 * on every item of a list says which item it acts on.
 *
 * Heights are read at 360 px, the narrowest screen the delivery supports. The
 * back links are found inside `main`, since the menu carries links with the
 * same names. Repeated buttons are found by their accessible name, which has
 * to start with the visible word (WCAG 2.5.3), so a voice command that says
 * what is on screen still reaches them.
 */
const TO_GENERATE = 'Física II — Teste rápido'
const ALREADY_GENERATED = 'Cálculo I — Prova 1'

/** The height a finger needs (RNF11). */
const TOUCH = 44

/** Spots on the padding, away from the rounded corners, which take no clicks. */
const LEFT_EDGE = { x: 6, y: 22 } as const

function expectTouchHeight<E extends HTMLElement>(subject: Cypress.Chainable<JQuery<E>>): void {
  subject.should('be.visible').invoke('outerHeight').should('be.gte', TOUCH)
}

function backLink(label: string): Cypress.Chainable<JQuery<HTMLAnchorElement>> {
  return cy.get('main').contains('a', label)
}

/** The button or link named `name` shows `visible`, and its name starts with it. */
function namedAfterItsText(name: string, visible: string): Cypress.Chainable<JQuery<HTMLElement>> {
  expect(name.startsWith(visible), 'o nome começa pelo texto visível').to.equal(true)
  return cy.get(`[aria-label="${name}"]`).should('have.text', visible)
}

function openDetailOf(title: string): void {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('h1', title).should('be.visible')
}

describe('alvos de toque em 360 px', () => {
  beforeEach(() => {
    cy.viewport(360, 740)
    cy.visitWithoutTours()
  })

  it('dá 44 px ao link de voltar das telas de turma, questão e prova', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Cálculo I — Noturno').click()
    expectTouchHeight(backLink('Turmas'))

    cy.visit('/questoes/nova')
    expectTouchHeight(backLink('Banco de questões'))

    cy.visit('/provas/nova')
    expectTouchHeight(backLink('Provas'))

    cy.visit('/provas')
    cy.contains('a', ALREADY_GENERATED).click()
    expectTouchHeight(backLink('Provas'))
  })

  it('dá 44 px ao link de voltar das telas de aplicação, correção e relatório', () => {
    cy.visit('/aplicacoes/nova')
    expectTouchHeight(backLink('Aplicações'))

    openDetailOf(TO_GENERATE)
    expectTouchHeight(backLink('Aplicações'))
    cy.contains('a', 'Gerar PDF').click()
    expectTouchHeight(backLink('Voltar'))

    openDetailOf(ALREADY_GENERATED)
    cy.contains('a', 'Corrigir folhas').click()
    expectTouchHeight(backLink('Aplicação'))
    cy.contains('a', 'Ver correções pendentes').click()
    expectTouchHeight(backLink('Folhas'))

    openDetailOf(ALREADY_GENERATED)
    cy.location('pathname').then((detail) => cy.visit(`${detail}/relatorio`))
    expectTouchHeight(backLink('Aplicação'))
  })

  it('dá 44 px ao link de voltar da revisão de uma folha', () => {
    cy.correctFirstSheetOf(ALREADY_GENERATED)
    cy.contains('a', 'Revisar').click()

    expectTouchHeight(backLink('Folhas'))
  })

  it('dá 44 px às linhas com caixa de marcar e ao número de versões da geração', () => {
    openDetailOf(TO_GENERATE)
    cy.contains('a', 'Gerar PDF').click()

    expectTouchHeight(cy.contains('label', 'Imprimir o nome do aluno em cada folha'))
    expectTouchHeight(cy.get('[aria-label="Embaralhar questões da versão 1"]').closest('label'))
    expectTouchHeight(cy.get('[aria-label="Embaralhar alternativas da versão 1"]').closest('label'))
    expectTouchHeight(cy.get('[aria-label="Quantas versões"]'))
  })

  it('dá 44 px às caixas de marcar da prova e da leitura das folhas', () => {
    cy.visit('/provas/nova')
    expectTouchHeight(cy.contains('label', 'Embaralhar as questões'))
    expectTouchHeight(cy.contains('label', 'Embaralhar as alternativas'))

    openDetailOf(ALREADY_GENERATED)
    cy.contains('a', 'Corrigir folhas').click()
    expectTouchHeight(cy.get('[aria-label="Marcar a folha 1 para leitura"]').closest('label'))
  })

  /** The label is the target: a tap beside the 16 px box still ticks it. */
  it('marca a folha pelo toque ao lado da caixa', () => {
    openDetailOf(ALREADY_GENERATED)
    cy.contains('a', 'Corrigir folhas').click()

    cy.get('[aria-label="Marcar a folha 1 para leitura"]').closest('label').click('topLeft')
    cy.get('[aria-label="Marcar a folha 1 para leitura"]').should('be.checked')
  })

  it('dá 44 px a "Sair" e ao aviso de privacidade no menu', () => {
    cy.visit('/painel')
    cy.get('button[aria-label="Abrir menu"]').click()

    expectTouchHeight(cy.get('[aria-label="Navegação principal"]').contains('button', 'Sair'))
    expectTouchHeight(cy.get('[aria-label="Navegação principal"]').contains('a', 'Aviso de privacidade'))
  })
})

describe('botões repetidos dizem de qual item são', () => {
  beforeEach(() => cy.visitWithoutTours())

  it('nomeia a turma em "Editar" e "Arquivar" de cada card', () => {
    cy.visit('/turmas')

    namedAfterItsText('Editar a turma Física II', 'Editar')
    namedAfterItsText('Arquivar a turma Física II', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').should('be.visible')
  })

  it('nomeia o aluno em "Anonimizar" e "Remover", e abre a confirmação dele', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Cálculo I — Noturno').click()

    namedAfterItsText('Anonimizar Ana Beatriz Moreira', 'Anonimizar')
    namedAfterItsText('Remover Ana Beatriz Moreira da turma', 'Remover').click()
    cy.findInDialog('h2', 'Remover Ana Beatriz Moreira da turma?').should('be.visible')
  })

  /** A long statement is cut at a word, so the name stays short enough to be heard. */
  it('nomeia a questão pelo começo do enunciado em "Duplicar" e "Excluir"', () => {
    cy.visit('/questoes')

    namedAfterItsText('Duplicar a questão A derivada de f(x) = x³ é:', 'Duplicar')
    namedAfterItsText('Excluir a questão A derivada de f(x) = x³ é:', 'Excluir')
    cy.get('[aria-label^="Duplicar a questão Explique com suas palavras"]')
      .invoke('attr', 'aria-label')
      .should('match', /…$/)
  })

  it('nomeia a prova em "Duplicar" e "Arquivar"', () => {
    cy.visit('/provas')

    namedAfterItsText(`Duplicar a prova ${TO_GENERATE}`, 'Duplicar')
    namedAfterItsText(`Arquivar a prova ${TO_GENERATE}`, 'Arquivar')
  })

  it('nomeia a aplicação, com turma e dia, em "Arquivar"', () => {
    cy.visit('/aplicacoes')

    namedAfterItsText(`Arquivar a aplicação ${ALREADY_GENERATED}, Cálculo I — Noturno · 05/10/2026`, 'Arquivar')
  })

  it('nomeia a folha e o aluno em "Revisar"', () => {
    cy.correctFirstSheetOf(ALREADY_GENERATED)

    cy.get('[aria-label^="Revisar a folha 1, "]').should('have.text', 'Revisar').click()
    cy.contains('h1', 'Folha 1').should('be.visible')
  })

  /**
   * A sheet printed without the student's name is read like any other and then
   * waits on P17 for its owner, one "Associar aluno" per sheet.
   */
  it('nomeia a folha em "Associar aluno", que também navega pela borda', () => {
    openDetailOf(TO_GENERATE)
    cy.contains('a', 'Gerar PDF').click()
    cy.contains('label', 'Imprimir o nome do aluno em cada folha').find('input').uncheck()
    cy.contains('button', 'Gerar PDF').click()
    cy.contains('10 folhas prontas para imprimir', { timeout: 20000 }).should('be.visible')

    cy.contains('a', 'Corrigir folhas').click()
    cy.get('[aria-label="Marcar a folha 1 para leitura"]').check()
    cy.contains('button', 'Ler 1 folhas').click()
    cy.contains(/\b1 de \d+ lidas/, { timeout: 10000 }).should('be.visible')
    cy.contains('a', 'Ver correções pendentes').click()

    namedAfterItsText('Associar aluno à folha 1', 'Associar aluno').click(LEFT_EDGE.x, LEFT_EDGE.y)
    cy.contains('h1', 'Folha 1').should('be.visible')
    cy.contains('h2', 'De quem é esta folha?').should('be.visible')
  })
})

export {}

/**
 * #141: a link that looks like a button navigates from all of its area, and
 * the keyboard stops on it once.
 *
 * Every spec used to click the middle of the text, which is the one spot the
 * nested link answered, so the bug passed CI. These click near the left edge,
 * inside the padding, where a button wrapping a link did nothing.
 */
const TOUR = '[aria-label^="Tour desta tela"]'

/** Spots on the padding, away from the rounded corners, which take no clicks. */
const LEFT_EDGE = { x: 6, y: 22 } as const

const TO_GENERATE = 'Física II — Teste rápido'
const ALREADY_GENERATED = 'Cálculo I — Prova 1'

/** The first visit to a screen with content opens its tour, which takes the focus. */
function skipTour(): void {
  cy.get(TOUR).contains('button', 'Pular').click()
  cy.get(TOUR).should('not.exist')
}

/**
 * One control, as tall as a button: no button around the link or inside it,
 * and the link's own box is the 44 px of the button.
 */
function expectOneControl(label: string): void {
  cy.contains('a', label).should(($link) => {
    expect($link.parents('button, a'), 'controle em volta do link').to.have.length(0)
    expect($link.find('button, a'), 'controle dentro do link').to.have.length(0)
    expect($link.outerHeight(), 'altura do link').to.be.at.least(44)
  })
}

/** Clicks the button near its left edge, outside its text, and checks where it led. */
function followFromTheEdge(label: string, heading: string): void {
  expectOneControl(label)
  cy.contains('a', label).click(LEFT_EDGE.x, LEFT_EDGE.y)
  cy.contains('h1', heading).should('be.visible')
}

describe('link com cara de botão', () => {
  it('navega ao clicar na borda de "Nova aplicação", e não só no texto', () => {
    cy.visit('/aplicacoes')

    followFromTheEdge('Nova aplicação', 'Nova aplicação')
  })

  /** Tab lands on the link and leaves it on the next press; Enter follows it. */
  it('para uma vez só no Tab e segue com Enter', () => {
    cy.visit('/aplicacoes')
    skipTour()

    cy.get('[aria-label="Ver o tour desta tela"]').focus()
    cy.press(Cypress.Keyboard.Keys.TAB)
    cy.focused().should('match', 'a[href]').and('contain', 'Nova aplicação')

    cy.press(Cypress.Keyboard.Keys.TAB)
    cy.focused().should('not.contain', 'Nova aplicação')

    cy.contains('a', 'Nova aplicação').focus()
    cy.press(Cypress.Keyboard.Keys.ENTER)
    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  it('deixa o tour apontar para o link, que é o próprio botão', () => {
    cy.visit('/aplicacoes')

    cy.contains('a', 'Nova aplicação').should('have.attr', 'data-tour', 'create').and('have.class', 'tour-target')
  })

  it('navega pela borda dos botões da lista de provas', () => {
    cy.visit('/provas')
    followFromTheEdge('Gerar automaticamente', 'Nova prova')

    cy.visit('/provas')
    followFromTheEdge('Nova prova', 'Nova prova')
  })

  it('navega pela borda de "Nova questão"', () => {
    cy.visit('/questoes')

    followFromTheEdge('Nova questão', 'Nova questão')
  })

  it('navega pela borda dos botões do detalhe da prova', () => {
    cy.visit('/provas')
    cy.contains('a', ALREADY_GENERATED).click()
    followFromTheEdge('Editar', 'Editar prova')

    cy.visit('/provas')
    cy.contains('a', ALREADY_GENERATED).click()
    followFromTheEdge('Nova aplicação com esta prova', 'Nova aplicação')
  })

  it('navega pela borda de "Gerar PDF" e de "Corrigir folhas" no detalhe da aplicação', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', TO_GENERATE).click()
    followFromTheEdge('Gerar PDF', `Gerar PDF — ${TO_GENERATE}`)

    cy.visit('/aplicacoes')
    cy.contains('a', ALREADY_GENERATED).click()
    followFromTheEdge('Corrigir folhas', 'Enviar folhas de respostas')
  })

  it('navega pela borda de "Revisar" na lista de folhas', () => {
    cy.readFirstSheetOf(ALREADY_GENERATED)

    followFromTheEdge('Revisar', 'Folha 1')
  })

  /** Nothing links to the report of an application with no correction, so it is opened by its address. */
  it('navega pela borda de "Corrigir folhas" no relatório sem correção', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', ALREADY_GENERATED).click()
    cy.contains('h1', ALREADY_GENERATED).should('be.visible')
    cy.location('pathname').then((detail) => cy.visit(`${detail}/relatorio`))
    cy.contains('h3', 'Nada corrigido ainda').should('be.visible')

    followFromTheEdge('Corrigir folhas', 'Enviar folhas de respostas')
  })

  it('navega pela borda dos botões de "não encontrado"', () => {
    cy.visit('/uma-rota-que-nao-existe', { failOnStatusCode: false })
    followFromTheEdge('Ir para o painel', 'Painel')

    cy.visit('/questoes/00000000-0000-0000-0000-000000000000')
    cy.contains('Questão não encontrada', { timeout: 10000 }).should('be.visible')
    followFromTheEdge('Voltar ao banco de questões', 'Banco de questões')
  })
})

describe('cabeçalho da tela', () => {
  /**
   * At 1366 px the description beside it squeezed "Nova aplicação" onto two
   * lines. The text now keeps to one line, and the button is wide enough to
   * hold it rather than letting it spill out.
   */
  it('mantém o texto do botão numa linha só em 1366 px', () => {
    cy.viewport(1366, 768)
    cy.visit('/aplicacoes')

    cy.contains('a', 'Nova aplicação').should(($link) => {
      const link = $link[0]
      expect($link.css('white-space'), 'quebra de linha').to.equal('nowrap')
      expect(link?.scrollWidth, 'texto dentro do botão').to.be.at.most((link?.clientWidth ?? 0) + 1)
    })
  })
})

export {}

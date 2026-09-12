/**
 * The widths the delivery has to survive, checked for the one failure that is
 * always a bug rather than a taste: content wider than the screen.
 *
 * Horizontal scrolling on a phone means something was laid out for a desktop
 * and shipped without being looked at.
 */
const SCREENS = [
  '/painel',
  '/turmas',
  '/questoes',
  '/provas',
  '/aplicacoes',
  '/privacidade',
] as const

const WIDTHS = [
  { name: 'celular pequeno', width: 360, height: 740 },
  { name: 'celular grande', width: 430, height: 930 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'notebook', width: 1280, height: 800 },
  { name: 'monitor', width: 1920, height: 1080 },
] as const

function expectNoHorizontalScroll() {
  cy.document().then((document) => {
    const { scrollWidth, clientWidth } = document.documentElement
    expect(scrollWidth, 'largura do conteúdo').to.be.at.most(clientWidth + 1)
  })
}

describe('responsividade', () => {
  WIDTHS.forEach(({ name, width, height }) => {
    describe(`${name} (${width}px)`, () => {
      beforeEach(() => cy.viewport(width, height))

      SCREENS.forEach((path) => {
        it(`não rola na horizontal em ${path}`, () => {
          cy.visit(path)
          cy.get('main, h1').should('exist')

          expectNoHorizontalScroll()
        })
      })
    })
  })

  it('esconde o menu lateral no celular e abre pelo hambúrguer', () => {
    cy.viewport(360, 740)
    cy.visit('/painel')

    cy.get('button[aria-label*="menu"], button[aria-label*="Menu"]').should('be.visible')
  })
})

describe('endereço que não existe', () => {
  it('explica e oferece o caminho de volta', () => {
    cy.visit('/uma-rota-que-nao-existe', { failOnStatusCode: false })

    cy.contains('h3', 'Página não encontrada').should('be.visible')
    cy.contains('a', 'Ir para o painel').click()

    cy.contains('h1', 'Painel').should('be.visible')
  })
})

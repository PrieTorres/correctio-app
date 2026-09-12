/**
 * The panel and the profile: where a term is read at a glance, and where the
 * tour and the account are managed.
 */
describe('painel', () => {
  beforeEach(() => cy.visit('/painel'))

  it('resume o semestre em números', () => {
    cy.contains('h1', 'Painel').should('be.visible')
    cy.contains('a', 'Turmas').should('be.visible')
    cy.contains('a', 'Questões').should('be.visible')
  })

  /** RNF06: any main action within three clicks of here. */
  it('abre uma nova prova em dois cliques a partir daqui', () => {
    cy.contains('a', 'Nova prova').click()

    cy.contains('h1', 'Nova prova').should('be.visible')
  })

  it('abre uma nova questão a partir dos atalhos', () => {
    cy.contains('a', 'Nova questão').click()

    cy.contains('h1', 'Nova questão').should('be.visible')
  })

  it('abre uma nova aplicação a partir dos atalhos', () => {
    cy.contains('a', 'Nova aplicação').click()

    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  it('mostra a atividade recente e leva ao detalhe', () => {
    cy.contains('h2', 'Atividade recente').should('be.visible')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.contains('h2', 'Versões').should('be.visible')
  })

  it('leva às listas pelos cartões de resumo', () => {
    cy.contains('a', 'Provas').click()

    cy.contains('h1', 'Provas').should('be.visible')
  })
})

describe('perfil', () => {
  beforeEach(() => cy.visit('/perfil'))

  it('mostra os dados da conta em leitura', () => {
    cy.contains('h1', 'Meu perfil').should('be.visible')
    cy.contains('h2', 'Dados da conta').should('be.visible')
  })

  it('confirma que o tour foi zerado', () => {
    cy.contains('button', 'Rever o tour').click()

    cy.get('[role="status"]').should('contain', 'volta a aparecer')
  })

  /** Anonymising cannot be undone, so it costs more than one click. */
  it('só libera anonimizar depois de digitar a palavra', () => {
    cy.contains('button', 'Anonimizar minha conta').should('be.disabled')

    cy.findByLabel('Digite ANONIMIZAR para confirmar').type('ANONIMIZAR')

    cy.contains('button', 'Anonimizar minha conta').should('not.be.disabled')
  })

  it('não aceita a palavra escrita de outro jeito', () => {
    cy.findByLabel('Digite ANONIMIZAR para confirmar').type('anonimizar')

    cy.contains('button', 'Anonimizar minha conta').should('be.disabled')
  })
})

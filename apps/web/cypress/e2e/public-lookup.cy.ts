/**
 * The only screen without a login, and it shows a name beside a grade.
 *
 * Everything here is about showing the least the rule allows: an unknown code
 * says so without hinting at anything, and the two levels of release nest.
 */
describe('consulta pública', () => {
  it('diz que o QR é inválido, sem erro técnico', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')

    cy.contains('h1', 'QR inválido').should('be.visible')
    cy.contains('Erro').should('not.exist')
  })

  it('oferece o aviso de privacidade a quem chegou pelo QR', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')

    cy.contains('a', 'Aviso de privacidade').click()

    cy.contains('h1', 'Aviso de privacidade').should('be.visible')
  })

  it('pede aos buscadores que não indexem a página', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')

    cy.get('head meta[name="robots"]').should('have.attr', 'content').and('contain', 'noindex')
  })

  it('mostra a nota só depois dos dois níveis de liberação', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.get('table tbody tr td:last-child')
      .first()
      .invoke('text')
      .then((code) => {
        const sheetCode = code.trim()

        cy.visit(`/r/${sheetCode}`)
        cy.contains('Ainda não liberado').should('be.visible')

        cy.visit('/aplicacoes')
        cy.contains('a', 'Cálculo I — Prova 1').click()
        cy.contains('button', 'Publicar gabarito').first().click()
        cy.contains('Gabarito publicado').should('be.visible')

        cy.visit(`/r/${sheetCode}`)
        cy.contains('h2', 'Gabarito').should('be.visible')
        cy.contains('Sua nota').should('not.exist')
      })
  })
})

/**
 * A correction left open still waits for the open-ended score, so its total is
 * not final: the student sees the answer key and no grade until the teacher
 * confirms. Everything after the code is read is done through the app's own
 * links, because a reload would destroy a write still in flight.
 */
describe('consulta pública com correção em andamento', () => {
  it('só mostra a nota depois que o professor confirma a correção', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.get('table tbody tr td:last-child')
      .first()
      .invoke('text')
      .then((code) => {
        const sheetCode = code.trim()

        cy.contains('button', 'Publicar gabarito').first().click()
        cy.contains('Gabarito publicado').should('be.visible')
        cy.contains('label', 'Liberar a consulta de nota').find('input').check()
        cy.contains('label', 'Liberar a consulta de nota').find('input').should('be.checked')

        cy.contains('a', 'Corrigir folhas').click()
        cy.get('input[aria-label="Marcar a folha 1 para leitura"]').check()
        cy.contains('button', 'Ler 1 folhas').click()
        cy.contains('a', 'Revisar', { timeout: 10000 }).first().click()
        cy.get('input[aria-label^="Nota da questão"]').first().clear().type('2.5')
        cy.contains('button', 'Salvar sem finalizar').click()
        cy.contains('Em andamento', { timeout: 10000 }).should('be.visible')

        cy.visit(`/r/${sheetCode}`)
        cy.contains('h2', 'Gabarito').should('be.visible')
        cy.contains('Sua nota').should('not.exist')

        cy.go('back')
        cy.contains('a', 'Revisar', { timeout: 10000 }).first().click()
        cy.contains('button', 'Confirmar correção').click()
        cy.contains('Corrigida', { timeout: 10000 }).should('be.visible')

        cy.visit(`/r/${sheetCode}`)
        cy.contains('h2', 'Sua nota').should('be.visible')
      })
  })
})

describe('aviso de privacidade', () => {
  beforeEach(() => cy.visit('/privacidade'))

  it('diz quais dados são tratados e para quê', () => {
    cy.contains('h2', 'Quais dados são tratados').should('be.visible')
    cy.contains('h2', 'Para quê').should('be.visible')
  })

  it('nomeia controlador e operador', () => {
    cy.contains('h2', 'Quem responde').should('be.visible')
    cy.contains('operador').should('be.visible')
  })

  it('explica os direitos e como exercê-los', () => {
    cy.contains('h2', 'Seus direitos').should('be.visible')
    cy.contains('h2', 'Contato').should('be.visible')
  })
})

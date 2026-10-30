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

  it('dá 44 px de altura ao link do aviso de privacidade e ao de voltar', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')
    cy.contains('a', 'Aviso de privacidade').invoke('outerHeight').should('be.gte', 44)

    cy.visit('/privacidade')
    cy.contains('a', 'Voltar para o início').invoke('outerHeight').should('be.gte', 44)
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
        cy.contains('button', 'Publicar todos').click()
        cy.findInDialog('button', 'Publicar todos').click()
        cy.contains('button', 'Publicar todos').should('not.exist')
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
 *
 * The page reads the sheet from the API, and the corrections still live in the
 * browser that graded them, so a confirmed grade cannot show here yet; the API
 * tests cover it with a correction in the database. Issue #48 moves the
 * corrections to the API, and then this scenario confirms the correction and
 * checks that the grade appears.
 */
describe('consulta pública com correção em andamento', () => {
  it('mostra só o gabarito enquanto a correção está em andamento', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.get('table tbody tr td:last-child')
      .first()
      .invoke('text')
      .then((code) => {
        const sheetCode = code.trim()

        cy.contains('button', 'Publicar todos').click()
        cy.findInDialog('button', 'Publicar todos').click()
        cy.contains('button', 'Publicar todos').should('not.exist')
        cy.contains('button', 'Liberar notas').click()
        cy.findInDialog('button', 'Liberar notas').click()
        cy.contains('button', 'Recolher notas').should('be.visible')

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

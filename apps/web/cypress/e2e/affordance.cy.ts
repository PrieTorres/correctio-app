/**
 * What is clickable has to look clickable before it is clicked.
 *
 * Tailwind 4 resets buttons to the browser's arrow, which made a screen full of
 * controls read as inert text, and the hover of a card was a shadow too faint
 * to notice. Both are single rules in `styles/index.css`, so a typo there is
 * invisible to every other spec: this one reads the computed style, which is
 * the only place the fix actually shows up.
 *
 * The card is reached by the class that carries the rule. That is a markup
 * detail everywhere else, and here it is the subject.
 */
const INTERACTIVE_CARD = '[class*="card-interactive"]'

describe('o que é clicável se comporta como clicável', () => {
  it('põe o ponteiro sobre os botões', () => {
    cy.visit('/turmas')

    cy.contains('button', 'Nova turma').should('have.css', 'cursor', 'pointer')
    cy.contains('button', 'Arquivar').should('have.css', 'cursor', 'pointer')
  })

  it('põe o ponteiro sobre os links', () => {
    cy.visit('/turmas')

    cy.contains('a', 'Cálculo I — Noturno').should('have.css', 'cursor', 'pointer')
  })

  it('mantém a seta no botão desligado, que não responde a clique', () => {
    cy.visit('/questoes')

    cy.contains('button', 'Importar questões')
      .should('be.disabled')
      .and('have.css', 'cursor', 'not-allowed')
  })

  it('põe o ponteiro no rótulo da caixa de seleção, que é onde se clica', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.contains('label', 'Liberar a consulta de nota')
      .should('have.css', 'cursor', 'pointer')
      .find('input')
      .should('have.css', 'cursor', 'pointer')
  })

  it('anima o card da turma no hover, para dizer que leva a algum lugar', () => {
    cy.visit('/turmas')

    cy.get(INTERACTIVE_CARD)
      .first()
      .should(($card) => {
        expect($card.css('transition-duration')).not.to.equal('0s')
        expect($card.css('transition-property')).to.contain('box-shadow')
      })
  })

  it('não anima o card que é só um painel', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Cálculo I — Noturno').click()

    cy.contains('h2', 'Alunos').closest(INTERACTIVE_CARD).should('not.exist')
  })
})

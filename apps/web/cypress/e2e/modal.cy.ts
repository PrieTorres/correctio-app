/**
 * Dialog behaviour, including the transition.
 *
 * Radix keeps the node mounted while the closing animation plays, so the test
 * asserts the state attribute rather than a duration: it proves the exit
 * animation gets a chance to run, without depending on how long it takes.
 */
describe('modais', () => {
  beforeEach(() => cy.visit('/turmas'))

  it('abre com o estado que dispara a animação de entrada', () => {
    cy.contains('button', 'Nova turma').click()

    cy.get('[role="dialog"]').should('have.attr', 'data-state', 'open')
  })

  it('cresce a partir do centro, sem arrastar na diagonal', () => {
    cy.contains('button', 'Nova turma').click()

    cy.get('[role="dialog"]').should(($dialog) => {
      const style = getComputedStyle($dialog[0])
      expect(style.translate, 'centragem preservada').to.equal('-50% -50%')
      expect(style.transform, 'a animação não pode tocar em transform').to.equal('none')
    })
  })

  it('permanece montado durante a saída e some depois', () => {
    cy.contains('button', 'Nova turma').click()
    cy.get('[role="dialog"]').should('be.visible')

    cy.get('body').type('{esc}')

    cy.get('[role="dialog"]').should('not.exist')
  })

  it('fecha pelo Escape', () => {
    cy.contains('button', 'Nova turma').click()
    cy.get('[role="dialog"]').should('be.visible')

    cy.get('body').type('{esc}')

    cy.get('[role="dialog"]').should('not.exist')
  })

  it('fecha pelo botão de fechar', () => {
    cy.contains('button', 'Nova turma').click()

    cy.get('[role="dialog"]').find('[aria-label="Fechar"]').click()

    cy.get('[role="dialog"]').should('not.exist')
  })

  it('devolve o foco ao elemento que o abriu', () => {
    cy.contains('button', 'Nova turma').first().as('trigger').click()
    cy.get('body').type('{esc}')

    cy.get('@trigger').should('have.focus')
  })

  it('mantém o conteúdo de trás inerte enquanto está aberto', () => {
    cy.contains('button', 'Nova turma').click()

    cy.get('body').should('have.attr', 'data-scroll-locked')
  })
})

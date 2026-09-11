/**
 * The question bank: the screen the client called the point of the product,
 * since writing a question once is what stops the work repeating every term.
 */
describe('banco de questões', () => {
  beforeEach(() => cy.visit('/questoes'))

  it('lista as questões semeadas', () => {
    cy.contains('h1', 'Banco de questões').should('be.visible')
    cy.contains('sen(x)/x').should('be.visible')
  })

  it('separa objetivas de discursivas', () => {
    cy.chooseSegment('Discursivas')

    cy.contains('Explique com suas palavras').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
  })

  it('filtra por tag', () => {
    cy.contains('button', 'Álgebra Linear').click()

    cy.contains('matriz quadrada').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
  })

  it('sinaliza a questão cuja ordem das alternativas é fixa', () => {
    cy.contains('ordem fixa').should('be.visible')
  })

  it('exclui e restaura sem perder a questão', () => {
    cy.contains('sen(x)/x').closest('li').contains('button', 'Excluir').click()
    cy.findInDialog('button', 'Excluir').click()
    cy.contains('sen(x)/x').should('not.exist')

    cy.chooseSegment('Excluídas')
    cy.contains('sen(x)/x').closest('li').contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()

    cy.chooseSegment('Ativas')
    cy.contains('sen(x)/x').should('be.visible')
  })

  it('distingue filtro sem resultado de banco vazio', () => {
    cy.get('input[type="search"]').type('zzzz')

    cy.contains('h3', 'Nenhuma questão encontrada').should('be.visible')
    cy.contains('h3', 'Nenhuma questão ainda').should('not.exist')
  })
})

describe('formulário de questão', () => {
  beforeEach(() => {
    cy.visit('/questoes')
    cy.contains('Nova questão').click()
  })

  it('cria uma objetiva e mostra na lista', () => {
    cy.get('#statement').type('Qual a integral de 2x?')
    cy.get('input[aria-label="Texto da alternativa A"]').type('x² + C')
    cy.get('input[aria-label="Texto da alternativa B"]').type('2')
    cy.get('input[aria-label="Alternativa A é a correta"]').check()
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Qual a integral de 2x?').should('be.visible')
  })

  it('já vem com a primeira alternativa marcada como correta', () => {
    cy.get('input[aria-label="Alternativa A é a correta"]').should('be.checked')
  })

  /**
   * Radios cannot be unchecked, and A comes marked, so "no correct
   * alternative" is only reachable by deleting the one that was marked.
   */
  it('recusa objetiva cuja alternativa correta foi removida', () => {
    cy.get('#statement').type('Questão sem gabarito')
    cy.get('input[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('input[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Alternativa').click()
    cy.get('input[aria-label="Texto da alternativa C"]').type('mais uma')
    cy.get('input[aria-label="Alternativa C é a correta"]').check()
    cy.get('button[aria-label="Remover alternativa C"]').click()
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Marque qual alternativa é a correta').should('be.visible')
  })

  it('troca os campos ao alternar para discursiva', () => {
    cy.chooseSegment('Discursiva')

    cy.contains('label', 'Nota máxima').should('be.visible')
    cy.contains('Alternativas').should('not.exist')
  })

  it('exige nota máxima na discursiva', () => {
    cy.chooseSegment('Discursiva')
    cy.get('#statement').type('Explique o teorema')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('nota máxima').should('be.visible')
  })

  it('não deixa remover abaixo de duas alternativas', () => {
    cy.get('button[aria-label="Remover alternativa A"]').should('not.exist')

    cy.contains('button', 'Alternativa').click()

    cy.get('button[aria-label="Remover alternativa A"]').should('exist')
  })

  it('para de oferecer alternativa ao chegar em cinco', () => {
    cy.contains('button', 'Alternativa').click()
    cy.contains('button', 'Alternativa').click()
    cy.contains('button', 'Alternativa').click()

    cy.get('input[aria-label="Texto da alternativa E"]').should('exist')
    cy.contains('button', 'Alternativa').should('not.exist')
  })
})

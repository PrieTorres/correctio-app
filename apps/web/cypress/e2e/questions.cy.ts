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

  it('sugere as tags que o banco já usa', () => {
    cy.contains('Nova questão').click()

    cy.contains('Já usadas:').should('be.visible')
    cy.contains('button', 'Limites').should('be.visible')
  })

  it('filtra as sugestões de tag conforme se digita', () => {
    cy.contains('Nova questão').click()

    cy.get('#tag-input').type('Matr')

    cy.contains('button', 'Matrizes').should('be.visible')
    cy.contains('button', 'Limites').should('not.exist')
  })

  it('adota a grafia que o banco já tem, ignorando acento e caixa', () => {
    cy.contains('Nova questão').click()

    cy.get('#tag-input').type('limites{enter}')

    cy.get('button[aria-label="Remover tag Limites"]').should('exist')
  })

  it('escolher uma sugestão não adiciona o rascunho ao lado', () => {
    cy.contains('Nova questão').click()

    cy.get('#tag-input').type('Limi')
    cy.contains('button', 'Limites').click()

    cy.get('button[aria-label="Remover tag Limites"]').should('exist')
    cy.get('button[aria-label="Remover tag Limi"]').should('not.exist')
  })

  it('busca sem acento encontra o que tem acento', () => {
    cy.get('input[type="search"]').type('limites')

    cy.contains('sen(x)/x').should('be.visible')
  })

  it('coloca a questão recém-criada no topo, em vez de perdê-la no meio', () => {
    cy.contains('a', 'Nova questão').click()
    cy.get('#statement').type('Questão acabada de escrever')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.get('main ul li').first().should('contain', 'Questão acabada de escrever')
  })

  it('alterna entre as mais recentes e a ordem alfabética', () => {
    cy.chooseSegment('A–Z')

    cy.get('main ul li').first().should('contain', 'A derivada')
  })

  it('encontra as questões sem tag, que nenhum filtro de tag mostra', () => {
    cy.contains('a', 'Nova questão').click()
    cy.get('#statement').type('Questão sem nenhuma tag')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('button', 'Sem tag').click()

    cy.contains('Questão sem nenhuma tag').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
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
    cy.get('[aria-label="Texto da alternativa A"]').type('x² + C')
    cy.get('[aria-label="Texto da alternativa B"]').type('2')
    cy.get('input[aria-label="Alternativa A é a correta"]').check()
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Qual a integral de 2x?').should('be.visible')
  })

  /** It refused the save and said nothing, which reads as a broken button. */
  it('diz por que não salva, em vez de recusar calado', () => {
    cy.get('#statement').type('Questão sem alternativas preenchidas')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Preencha o texto de todas as alternativas').should('be.visible')
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
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Alternativa').click()
    cy.get('[aria-label="Texto da alternativa C"]').type('mais uma')
    cy.get('input[aria-label="Alternativa C é a correta"]').check()
    cy.get('button[aria-label="Remover alternativa C"]').click()
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Marque qual alternativa é a correta').should('be.visible')
  })

  it('troca os campos ao alternar para discursiva', () => {
    cy.chooseSegment('Discursiva')

    cy.contains('h2', 'Resposta discursiva').should('be.visible')
    cy.contains('label', 'Nota máxima').should('be.visible')
    cy.contains('legend', 'Alternativas').should('not.exist')
  })

  it('explica por que a discursiva não tem gabarito', () => {
    cy.chooseSegment('Discursiva')

    cy.contains('corrige as objetivas sozinho').should('be.visible')
  })

  /**
   * Scoped to the rows: "Objetiva" is also the text of a filter segment above
   * them, and an unscoped match lands there instead.
   */
  it('distingue os dois tipos por cor e por ícone na lista', () => {
    cy.visit('/questoes')

    cy.contains('sen(x)/x').closest('li').contains('span', 'Objetiva').find('svg').should('exist')
    cy.contains('Explique com suas palavras')
      .closest('li')
      .contains('span', 'Discursiva')
      .find('svg')
      .should('exist')
  })

  it('mostra as tags como chips próprios', () => {
    cy.visit('/questoes')

    cy.contains('sen(x)/x').closest('li').contains('span', 'Limites').should('be.visible')
  })

  it('destaca visualmente a alternativa marcada como correta', () => {
    cy.get('[aria-label="Texto da alternativa A"]').closest('div').should('have.class', 'border-primary')

    cy.get('input[aria-label="Alternativa B é a correta"]').check()

    cy.get('[aria-label="Texto da alternativa B"]').closest('div').should('have.class', 'border-primary')
    cy.get('[aria-label="Texto da alternativa A"]').closest('div').should('not.have.class', 'border-primary')
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

    cy.get('[aria-label="Texto da alternativa E"]').should('exist')
    cy.contains('button', 'Alternativa').should('not.exist')
  })
})

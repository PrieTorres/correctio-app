/**
 * The question bank: the screen the client called the point of the product,
 * since writing a question once is what stops the work repeating every term.
 */

function seedQuestions() {
  cy.request<{ accessToken: string }>('POST', '/api/auth/refresh').then((response) => {
    const token = response.body.accessToken
    const headers = { Authorization: `Bearer ${token}` }

    const alt1 = crypto.randomUUID()
    const alt2 = crypto.randomUUID()
    const alt3 = crypto.randomUUID()
    const alt4 = crypto.randomUUID()
    const alt5 = crypto.randomUUID()
    const alt6 = crypto.randomUUID()

    const questions = [
      {
        type: 'objetiva',
        statement: 'sen(x)/x',
        tags: ['Limites'],
        alternatives: [
          { id: alt1, text: '1' },
          { id: alt2, text: '0' }
        ],
        correctAlternativeId: alt1,
        allowShuffleAlternatives: false
      },
      {
        type: 'discursiva',
        statement: 'Explique com suas palavras',
        tags: ['Conceitos'],
        maxScore: 2,
        allowShuffleAlternatives: false
      },
      {
        type: 'objetiva',
        statement: 'A derivada',
        tags: ['Derivadas'],
        alternatives: [
          { id: alt3, text: '2x' },
          { id: alt4, text: 'x' }
        ],
        correctAlternativeId: alt3,
        allowShuffleAlternatives: true
      },
      {
        type: 'objetiva',
        statement: 'matriz quadrada',
        tags: ['Ãlgebra Linear'],
        alternatives: [
          { id: alt5, text: 'quadrada' },
          { id: alt6, text: 'retangular' }
        ],
        correctAlternativeId: alt5,
        allowShuffleAlternatives: true
      }
    ]

    cy.wrap(questions).each((question) => {
      cy.request({
        method: 'POST',
        url: '/api/questions',
        headers,
        body: question
      })
    })
  })
}

describe('banco de questÃµes', () => {
  before(seedQuestions)

  beforeEach(() => cy.visit('/questoes'))

  it('lista as questÃµes semeadas', () => {
    cy.contains('h1', 'Banco de questÃµes').should('be.visible')
    cy.contains('sen(x)/x').should('be.visible')
  })

  it('separa objetivas de discursivas', () => {
    cy.chooseSegment('Discursivas')

    cy.contains('Explique com suas palavras').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
  })

  it('filtra por tag', () => {
    cy.contains('button', 'Ãlgebra Linear').click()

    cy.contains('matriz quadrada').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
  })

  it('sinaliza a questÃ£o cuja ordem das alternativas Ã© fixa', () => {
    cy.contains('ordem fixa').should('be.visible')
  })

  it('exclui e restaura sem perder a questÃ£o', () => {
    cy.contains('sen(x)/x').closest('li').contains('button', 'Excluir').click()
    cy.findInDialog('button', 'Excluir').click()
    cy.contains('sen(x)/x').should('not.exist')

    cy.chooseSegment('ExcluÃ­das')
    cy.contains('sen(x)/x').closest('li').contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()

    cy.chooseSegment('Ativas')
    cy.contains('sen(x)/x').should('be.visible')
  })

  it('sugere as tags que o banco jÃ¡ usa', () => {
    cy.contains('Nova questÃ£o').click()

    cy.contains('JÃ¡ usadas:').should('be.visible')
    cy.contains('button', 'Limites').should('be.visible')
  })

  it('filtra as sugestÃµes de tag conforme se digita', () => {
    cy.contains('Nova questÃ£o').click()

    cy.findByLabel('Tags de conteÃºdo').type('Matr')

    cy.contains('button', 'Matrizes').should('be.visible')
    cy.contains('button', 'Limites').should('not.exist')
  })

  it('adota a grafia que o banco jÃ¡ tem, ignorando acento e caixa', () => {
    cy.contains('Nova questÃ£o').click()

    cy.findByLabel('Tags de conteÃºdo').type('limites{enter}')

    cy.get('button[aria-label="Remover tag Limites"]').should('exist')
  })

  it('escolher uma sugestÃ£o nÃ£o adiciona o rascunho ao lado', () => {
    cy.contains('Nova questÃ£o').click()

    cy.findByLabel('Tags de conteÃºdo').type('Limi')
    cy.contains('button', 'Limites').click()

    cy.get('button[aria-label="Remover tag Limites"]').should('exist')
    cy.get('button[aria-label="Remover tag Limi"]').should('not.exist')
  })

  it('busca sem acento encontra o que tem acento', () => {
    cy.get('input[type="search"]').type('limites')

    cy.contains('sen(x)/x').should('be.visible')
  })

  it('coloca a questÃ£o recÃ©m-criada no topo, em vez de perdÃª-la no meio', () => {
    cy.contains('a', 'Nova questÃ£o').click()
    cy.findByLabel('Enunciado').type('QuestÃ£o acabada de escrever')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.get('main ul li').first().should('contain', 'QuestÃ£o acabada de escrever')
  })

  it('alterna entre as mais recentes e a ordem alfabÃ©tica', () => {
    cy.chooseSegment('Aâ€“Z')

    cy.get('main ul li').first().should('contain', 'A derivada')
  })

  it('encontra as questÃµes sem tag, que nenhum filtro de tag mostra', () => {
    cy.contains('a', 'Nova questÃ£o').click()
    cy.findByLabel('Enunciado').type('QuestÃ£o sem nenhuma tag')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.contains('button', 'Sem tag').click()

    cy.contains('QuestÃ£o sem nenhuma tag').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
  })

  it('distingue filtro sem resultado de banco vazio', () => {
    cy.get('input[type="search"]').type('zzzz')

    cy.contains('h3', 'Nenhuma questÃ£o encontrada').should('be.visible')
    cy.contains('h3', 'Nenhuma questÃ£o ainda').should('not.exist')
  })

  it('mostra o total e os controles de paginaÃ§Ã£o', () => {
    cy.contains('PÃ¡gina 1 de 1').should('be.visible')
    cy.contains('button', 'Anterior').should('be.disabled')
    cy.contains('button', 'PrÃ³xima').should('be.disabled')
  })
})

describe('formulÃ¡rio de questÃ£o', () => {
  beforeEach(() => {
    cy.visit('/questoes')
    cy.contains('Nova questÃ£o').click()
  })

  it('cria uma objetiva e mostra na lista', () => {
    cy.findByLabel('Enunciado').type('Qual a integral de 2x?')
    cy.get('[aria-label="Texto da alternativa A"]').type('xÂ² + C')
    cy.get('[aria-label="Texto da alternativa B"]').type('2')
    cy.get('input[aria-label="Alternativa A Ã© a correta"]').check()
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.contains('Qual a integral de 2x?').should('be.visible')
  })

  it('diz por que nÃ£o salva, em vez de recusar calado', () => {
    cy.findByLabel('Enunciado').type('QuestÃ£o sem alternativas preenchidas')
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.contains('Preencha o texto de todas as alternativas').should('be.visible')
  })

  it('jÃ¡ vem com a primeira alternativa marcada como correta', () => {
    cy.get('input[aria-label="Alternativa A Ã© a correta"]').should('be.checked')
  })

  it('recusa objetiva cuja alternativa correta foi removida', () => {
    cy.findByLabel('Enunciado').type('QuestÃ£o sem gabarito')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Alternativa').click()
    cy.get('[aria-label="Texto da alternativa C"]').type('mais uma')
    cy.get('input[aria-label="Alternativa C Ã© a correta"]').check()
    cy.get('button[aria-label="Remover alternativa C"]').click()
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.contains('Marque qual alternativa Ã© a correta').should('be.visible')
  })

  it('troca os campos ao alternar para discursiva', () => {
    cy.chooseSegment('Discursiva')

    cy.contains('h2', 'Resposta discursiva').should('be.visible')
    cy.contains('label', 'Nota mÃ¡xima').should('be.visible')
    cy.contains('legend', 'Alternativas').should('not.exist')
  })

  it('explica por que a discursiva nÃ£o tem gabarito', () => {
    cy.chooseSegment('Discursiva')

    cy.contains('corrige as objetivas sozinho').should('be.visible')
  })

  it('distingue os dois tipos por cor e por Ã­cone na lista', () => {
    cy.visit('/questoes')

    cy.contains('sen(x)/x').closest('li').contains('span', 'Objetiva').find('svg').should('exist')
    cy.contains('Explique com suas palavras')
      .closest('li')
      .contains('span', 'Discursiva')
      .find('svg')
      .should('exist')
  })

  it('mostra as tags como chips prÃ³prios', () => {
    cy.visit('/questoes')

    cy.contains('sen(x)/x').closest('li').contains('span', 'Limites').should('be.visible')
  })

  it('destaca visualmente a alternativa marcada como correta', () => {
    cy.get('[aria-label="Texto da alternativa A"]').closest('div').should('have.class', 'border-primary')

    cy.get('input[aria-label="Alternativa B Ã© a correta"]').check()

    cy.get('[aria-label="Texto da alternativa B"]').closest('div').should('have.class', 'border-primary')
    cy.get('[aria-label="Texto da alternativa A"]').closest('div').should('not.have.class', 'border-primary')
  })

  it('exige nota mÃ¡xima na discursiva', () => {
    cy.chooseSegment('Discursiva')
    cy.findByLabel('Enunciado').type('Explique o teorema')
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.contains('nota mÃ¡xima').should('be.visible')
  })

  it('nÃ£o deixa remover abaixo de duas alternativas', () => {
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

describe('editar questÃ£o', () => {
  beforeEach(() => {
    cy.visit('/questoes')
    cy.contains('a', 'sen(x)/x').click()
    cy.contains('h1', 'Editar questÃ£o').should('be.visible')
  })

  it('limpa as alternativas quando a objetiva vira discursiva', () => {
    cy.chooseSegment('Discursiva')
    cy.findByLabel('Nota mÃ¡xima').type('3')
    cy.contains('button', 'Salvar questÃ£o').click()

    cy.contains('h1', 'Banco de questÃµes').should('be.visible')

    cy.chooseSegment('Discursivas')
    cy.contains('sen(x)/x').should('be.visible')

    cy.chooseSegment('Objetivas')
    cy.contains('sen(x)/x').should('not.exist')
  })
})

describe('questÃ£o inexistente', () => {
  it('mostra "nÃ£o encontrada" em vez de formulÃ¡rio vazio', () => {
    cy.visit('/questoes/00000000-0000-0000-0000-000000000000')

    cy.contains('QuestÃ£o nÃ£o encontrada').should('be.visible')
  })
})

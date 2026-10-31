import type { QuestionInput } from '@/lib/schemas'
import { apiAs, type SignedInTeacher } from '../support/commands'

/**
 * The question bank: the screen the client called the point of the product,
 * since writing a question once is what stops the work repeating every term.
 */

/**
 * A teacher of the spec's own, with only these four questions: the sample
 * questions every other spec starts from would change what each filter here
 * finds.
 */
function seedQuestions() {
  cy.signInAsNewTeacher({ withSampleData: false })
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
        tags: ['Álgebra Linear'],
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

describe('banco de questões', () => {
  beforeEach(() => {
    seedQuestions()
    cy.visit('/questoes')
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
  })

  it('lista as questões semeadas', () => {
    cy.contains('sen(x)/x', { timeout: 10000 }).should('be.visible')
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
    cy.contains('a', 'Nova questão').click()

    cy.contains('Já usadas:').should('be.visible')
    cy.contains('button', 'Limites').should('be.visible')
  })

  it('filtra as sugestões de tag conforme se digita', () => {
    cy.contains('a', 'Nova questão').click()

    cy.findByLabel('Tags de conteúdo').type('Limi')

    cy.contains('button', 'Limites').should('be.visible')
    cy.contains('button', 'Conceitos').should('not.exist')
  })

  it('adota a grafia que o banco já tem, ignorando acento e caixa', () => {
    cy.contains('a', 'Nova questão').click()

    cy.findByLabel('Tags de conteúdo').type('limites{enter}')

    cy.get('[aria-label="Remover tag Limites"]').should('exist')
  })

  it('escolher uma sugestão não adiciona o rascunho ao lado', () => {
    cy.contains('a', 'Nova questão').click()

    cy.findByLabel('Tags de conteúdo').type('Limi')
    cy.contains('button', 'Limites').click()

    cy.get('[aria-label="Remover tag Limites"]').should('exist')
    cy.get('[aria-label="Remover tag Limi"]').should('not.exist')
  })

  it('busca sem acento encontra o que tem acento', () => {
    cy.get('[aria-label="Buscar questões"]').type('limites')

    cy.contains('sen(x)/x').should('be.visible')
  })

  it('coloca a questão recém-criada no topo, em vez de perdê-la no meio', () => {
    cy.contains('a', 'Nova questão').click()
    cy.findByLabel('Enunciado').type('Questão acabada de escrever')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.get('main ul li').first().should('contain', 'Questão acabada de escrever')
  })

  it('alterna entre as mais recentes e a ordem alfabética', () => {
    cy.chooseSegment('A–Z')
    
    cy.get('main ul li').first().should('contain', 'A derivada')
  })

  it('encontra as questões sem tag, que nenhum filtro de tag mostra', () => {
    cy.contains('a', 'Nova questão').click()
    cy.findByLabel('Enunciado').type('Questão sem nenhuma tag')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.contains('button', 'Sem tag').click()

    cy.contains('Questão sem nenhuma tag').should('be.visible')
    cy.contains('sen(x)/x').should('not.exist')
  })

  it('distingue filtro sem resultado de banco vazio', () => {
    cy.get('[aria-label="Buscar questões"]').type('zzzz')

    cy.contains('h3', 'Nenhuma questão encontrada').should('be.visible')
    cy.contains('h3', 'Nenhuma questão ainda').should('not.exist')
  })

  it('duplica uma questão, com "(cópia)" no enunciado', () => {
    cy.contains('li', 'A derivada').contains('button', 'Duplicar').click()

    cy.contains('li', 'A derivada (cópia)').should('be.visible').and('contain', '2 alternativas')
    cy.contains('li', 'A derivada (cópia)').should('contain', 'Derivadas')
  })

  /** Fifty-one questions from the API, so the list has a second page to reach without creating them all. */
  it('pagina quando há mais questões do que cabem numa página', () => {
    const total = 51
    cy.intercept({ method: 'GET', pathname: '/api/questions' }, (req) => {
      const start = (Number(req.query.page ?? 1) - 1) * 50
      const items = Array.from({ length: Math.min(50, total - start) }, (_, index) => {
        const number = String(start + index + 1).padStart(2, '0')
        return {
          id: `questao-${number}`,
          teacherId: 'professor-da-lista',
          type: 'discursiva',
          statement: `Questão ${number}`,
          tags: [],
          maxScore: 1,
          allowShuffleAlternatives: true,
        }
      })
      req.reply({ items, total })
    })
    cy.visit('/questoes')
    cy.get('[aria-label^="Tour desta tela"]').contains('button', 'Pular').click()

    cy.contains('Mostrando 1–50 de 51').should('be.visible')
    cy.contains('a', 'Questão 51').should('not.exist')

    cy.contains('button', 'Próxima').click()
    cy.contains('a', 'Questão 51').should('be.visible')
    cy.contains('Mostrando 51–51 de 51').should('be.visible')

    cy.contains('button', 'Anterior').click()
    cy.contains('a', 'Questão 01').should('be.visible')
  })
})

/** Opens an empty question form from the bank, the way the teacher reaches it. */
function openNewQuestionForm() {
  seedQuestions()
  cy.visit('/questoes')
  cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
  cy.contains('a', 'Nova questão').click()
  cy.contains('h1', 'Nova questão', { timeout: 10000 }).should('be.visible')
}

describe('formulário de questão', () => {
  beforeEach(openNewQuestionForm)

  it('cria uma objetiva e mostra na lista', () => {
    cy.findByLabel('Enunciado').type('Qual a integral de 2x?')
    cy.get('[aria-label="Texto da alternativa A"]').type('x² + C')
    cy.get('[aria-label="Texto da alternativa B"]').type('2')
    cy.get('[aria-label="Alternativa A é a correta"]').check()
    cy.contains('button', 'Salvar questão').click()

    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.contains('Qual a integral de 2x?').should('be.visible')
  })

  /** Saved on the API, not in this browser: read again from the server, the question is still there. */
  it('a questão criada continua lá depois de recarregar a página', () => {
    cy.findByLabel('Enunciado').type('Qual a derivada de 3x?')
    cy.get('[aria-label="Texto da alternativa A"]').type('3')
    cy.get('[aria-label="Texto da alternativa B"]').type('x')
    cy.contains('button', 'Salvar questão').click()
    cy.contains('a', 'Qual a derivada de 3x?', { timeout: 10000 }).should('be.visible')

    cy.reload()

    cy.contains('h1', 'Banco de questões').should('be.visible')
    cy.contains('a', 'Qual a derivada de 3x?').should('be.visible')
  })

  it('diz por que não salva, em vez de recusar calado', () => {
    cy.findByLabel('Enunciado').type('Questão sem alternativas preenchidas')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Preencha o texto de todas as alternativas').should('be.visible')
  })

  it('já vem com a primeira alternativa marcada como correta', () => {
    cy.get('[aria-label="Alternativa A é a correta"]').should('be.checked')
  })

  it('recusa objetiva cuja alternativa correta foi removida', () => {
    cy.findByLabel('Enunciado').type('Questão sem gabarito')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Alternativa').click()
    cy.get('[aria-label="Texto da alternativa C"]').type('mais uma')
    cy.get('[aria-label="Alternativa C é a correta"]').check()
    cy.get('[aria-label="Remover alternativa C"]').click()
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

  it('distingue os dois tipos por cor e por ícone na lista', () => {
    cy.visit('/questoes')
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')

    cy.contains('sen(x)/x').closest('li').contains('span', 'Objetiva').find('svg').should('exist')
    cy.contains('Explique com suas palavras')
      .closest('li')
      .contains('span', 'Discursiva')
      .find('svg')
      .should('exist')
  })

  it('mostra as tags como chips próprios', () => {
    cy.visit('/questoes')
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')

    cy.contains('sen(x)/x').closest('li').contains('span', 'Limites').should('be.visible')
  })

  it('destaca visualmente a alternativa marcada como correta', () => {
    cy.get('[aria-label="Texto da alternativa A"]').closest('div').should('have.class', 'border-primary')

    cy.get('[aria-label="Alternativa B é a correta"]').check()

    cy.get('[aria-label="Texto da alternativa B"]').closest('div').should('have.class', 'border-primary')
    cy.get('[aria-label="Texto da alternativa A"]').closest('div').should('not.have.class', 'border-primary')
  })

  it('exige nota máxima na discursiva', () => {
    cy.chooseSegment('Discursiva')
    cy.findByLabel('Enunciado').type('Explique o teorema')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('nota máxima').should('be.visible')
  })

  it('não deixa remover abaixo de duas alternativas', () => {
    cy.get('[aria-label="Remover alternativa A"]').should('not.exist')

    cy.contains('button', 'Alternativa').click()

    cy.get('[aria-label="Remover alternativa A"]').should('exist')
  })

  it('para de oferecer alternativa ao chegar em cinco', () => {
    cy.contains('button', 'Alternativa').click()
    cy.contains('button', 'Alternativa').click()
    cy.contains('button', 'Alternativa').click()

    cy.get('[aria-label="Texto da alternativa E"]').should('exist')
    cy.contains('button', 'Alternativa').should('not.exist')
  })
})

/**
 * One scenario per bug of #184: inputs the database could not store as typed.
 * Each one failed the save with a 500, or was stored rounded and then broke
 * the bank; now the form says why on the field, or keeps one tag.
 */
describe('questão contra os limites do banco (#184)', () => {
  beforeEach(openNewQuestionForm)

  /** A max score the form never sends; the field shows why, and the bank keeps loading. */
  it('recusa nota máxima com mais de 2 casas, e o banco continua carregando (bug 1)', () => {
    cy.chooseSegment('Discursiva')
    cy.findByLabel('Enunciado').type('Nota com três casas')
    cy.findByLabel('Nota máxima').type('0.001')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('A nota máxima aceita no máximo 2 casas decimais').should('be.visible')
    cy.contains('h1', 'Nova questão').should('be.visible')

    cy.contains('a', 'Banco de questões').click()
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.chooseSegment('Discursivas')
    cy.contains('Explique com suas palavras').should('be.visible')
    cy.contains('Nota com três casas').should('not.exist')
    cy.contains('Não foi possível carregar').should('not.exist')
  })

  it('trata como uma só as tags que só diferem em maiúscula ou acento (bug 2)', () => {
    cy.intercept('POST', '/api/questions').as('save')
    cy.findByLabel('Enunciado').type('Tags que só mudam a caixa')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.findByLabel('Tags de conteúdo').type('Integrais{enter}')
    cy.findByLabel('Tags de conteúdo').type('integrais{enter}')
    cy.findByLabel('Tags de conteúdo').type('Função{enter}')
    cy.findByLabel('Tags de conteúdo').type('Funcao{enter}')

    cy.get('[aria-label="Remover tag Integrais"]').should('exist')
    cy.get('[aria-label="Remover tag integrais"]').should('not.exist')
    cy.get('[aria-label="Remover tag Função"]').should('exist')
    cy.get('[aria-label="Remover tag Funcao"]').should('not.exist')
    cy.contains('button', 'Salvar questão').click()

    cy.wait('@save').its('response.statusCode').should('eq', 201)
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.contains('li', 'Tags que só mudam a caixa').should('contain', 'Integrais').and('contain', 'Função')
  })

  /** The long tag stays in the input with the reason, so the teacher shortens it instead of retyping. */
  it('recusa tag com mais de 80 caracteres, dizendo o limite (bug 3)', () => {
    const long = 'a'.repeat(81)
    cy.findByLabel('Tags de conteúdo').type(`${long}{enter}`, { delay: 0 })

    cy.contains('Cada tag pode ter no máximo 80 caracteres').should('be.visible')
    cy.get(`[aria-label="Remover tag ${long}"]`).should('not.exist')

    cy.findByLabel('Tags de conteúdo').type('{backspace}{enter}')
    cy.get(`[aria-label="Remover tag ${'a'.repeat(80)}"]`).should('exist')
    cy.contains('Cada tag pode ter no máximo 80 caracteres').should('not.exist')

    cy.findByLabel('Enunciado').type('Tag no limite da coluna')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.contains('Tag no limite da coluna').should('be.visible')
  })

  it('recusa nota máxima acima de 9999,99, dizendo o máximo (bug 4)', () => {
    cy.chooseSegment('Discursiva')
    cy.findByLabel('Enunciado').type('Nota acima do teto')
    cy.findByLabel('Nota máxima').type('10000')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('A nota máxima pode ser no máximo 9999,99').should('be.visible')
    cy.contains('h1', 'Nova questão').should('be.visible')

    cy.findByLabel('Nota máxima').clear().type('9999.99')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.contains('Nota acima do teto').should('be.visible')
  })

  it('recusa enunciado só com espaços, como o vazio (bug 5)', () => {
    cy.findByLabel('Enunciado').type('     ')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('Informe o enunciado').should('be.visible')
    cy.contains('h1', 'Nova questão').should('be.visible')
  })
})

describe('editar questão', () => {
  beforeEach(() => {
    seedQuestions()
    cy.visit('/questoes')
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')
    cy.contains('a', 'sen(x)/x').click()
    cy.contains('h1', 'Editar questão', { timeout: 10000 }).should('be.visible')
  })

  it('limpa as alternativas quando a objetiva vira discursiva', () => {
    cy.chooseSegment('Discursiva')
    cy.findByLabel('Nota máxima').type('3')
    cy.contains('button', 'Salvar questão').click()

    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')

    cy.chooseSegment('Discursivas')
    cy.contains('sen(x)/x').should('be.visible')

    cy.chooseSegment('Objetivas')
    cy.contains('sen(x)/x').should('not.exist')
  })
})

describe('questão inexistente', () => {
  it('mostra "não encontrada" em vez de formulário vazio', () => {
    cy.visit('/questoes/00000000-0000-0000-0000-000000000000')

    cy.contains('Questão não encontrada', { timeout: 10000 }).should('be.visible')
  })
})

/**
 * What #63 asked of the bank against the API that the scenarios above leave
 * out: a teacher with nothing yet, a list longer than a page written to the
 * database (not stubbed), a save the server refuses, and an edit reopened
 * through the app's own links.
 */
describe('banco de questões contra a API (#63)', () => {
  /** A teacher of the test's own, with nothing in the bank, and the token that writes as them. */
  function startWithEmptyBank(): Cypress.Chainable<SignedInTeacher> {
    cy.clearCookies()
    return cy.signInAsNewTeacher({ withSampleData: false })
  }

  function objective(statement: string, tags: string[] = []): QuestionInput {
    const right = crypto.randomUUID()
    return {
      type: 'objetiva',
      statement,
      tags,
      alternatives: [
        { id: crypto.randomUUID(), text: 'Errada' },
        { id: right, text: 'Certa' },
        { id: crypto.randomUUID(), text: 'Outra errada' },
      ],
      correctAlternativeId: right,
      allowShuffleAlternatives: true,
    }
  }

  it('mostra o banco vazio e a lixeira vazia a um professor novo', () => {
    startWithEmptyBank()
    cy.visit('/questoes')

    cy.contains('h3', 'Nenhuma questão ainda').should('be.visible')
    cy.chooseSegment('Excluídas')
    cy.contains('h3', 'Nenhuma questão excluída').should('be.visible')
  })

  /**
   * The filter is the server's: a page holds fifty, newest first, and the
   * open-ended question was written before them all, so it sits on page 2
   * until the filter asks the server for it.
   */
  it('o filtro "Discursivas" acha a discursiva que a primeira página não mostra', () => {
    startWithEmptyBank().then(({ accessToken }) => {
      const api = apiAs(accessToken)
      api('POST', '/questions', { type: 'discursiva', statement: 'A discursiva escondida', tags: [], maxScore: 2, allowShuffleAlternatives: true })
      Cypress._.times(51, (index) => api('POST', '/questions', objective(`Objetiva ${String(index + 1).padStart(2, '0')}`)))
    })
    cy.visit('/questoes')

    cy.contains('Mostrando 1–50 de 52', { timeout: 10000 }).should('be.visible')
    cy.contains('a', 'A discursiva escondida').should('not.exist')
    cy.chooseSegment('Discursivas')
    cy.contains('a', 'A discursiva escondida').should('be.visible')
    cy.contains('a', 'Objetiva 01').should('not.exist')
  })

  it('mostra o erro do servidor e continua no formulário', () => {
    cy.intercept('POST', '/api/questions', { statusCode: 500, body: { code: 'FAILURE', message: 'Erro inesperado no servidor.' } }).as('save')
    cy.visit('/questoes/nova')
    cy.findByLabel('Enunciado').type('Questão que o servidor recusa')
    cy.get('[aria-label="Texto da alternativa A"]').type('uma')
    cy.get('[aria-label="Texto da alternativa B"]').type('outra')
    cy.contains('button', 'Salvar questão').click()

    cy.wait('@save')
    cy.get('[role="alert"]').should('be.visible')
    cy.contains('h1', 'Nova questão').should('be.visible')
    cy.findByLabel('Enunciado').should('have.value', 'Questão que o servidor recusa')
  })

  /** Reopened through the list's link, never by reloading, which would cut the save short. */
  it('edita e reabre sem perder enunciado, tags, alternativas e gabarito', () => {
    startWithEmptyBank().then(({ accessToken }) => {
      apiAs(accessToken)('POST', '/questions', objective('Questão para editar', ['Limites']))
    })
    cy.visit('/questoes')
    cy.contains('a', 'Questão para editar').click()
    cy.contains('h1', 'Editar questão', { timeout: 10000 }).should('be.visible')

    cy.findByLabel('Enunciado').clear().type('Questão editada')
    cy.findByLabel('Tags de conteúdo').type('Derivadas{enter}')
    cy.contains('button', 'Salvar questão').click()
    cy.contains('h1', 'Banco de questões', { timeout: 10000 }).should('be.visible')

    cy.contains('a', 'Questão editada').click()
    cy.contains('h1', 'Editar questão', { timeout: 10000 }).should('be.visible')
    cy.findByLabel('Enunciado').should('have.value', 'Questão editada')
    cy.get('[aria-label="Remover tag Limites"]').should('exist')
    cy.get('[aria-label="Remover tag Derivadas"]').should('exist')
    cy.get('[aria-label="Texto da alternativa C"]').should('have.value', 'Outra errada')
    cy.get('[aria-label="Alternativa B é a correta"]').should('be.checked')
  })
})

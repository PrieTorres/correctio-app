/**
 * Exam composition: the bank turned into something that can be applied.
 *
 * Nothing here touches a class or a date. The exam is the content and the
 * application is the event, and that separation is what lets the same exam
 * serve several classes and several terms.
 */

const LIMITS = 'Qual é o valor de lim(x→0) sen(x)/x?'
const DERIVATIVE = 'A derivada de f(x) = x³ é:'
const MATRIX = 'Uma matriz quadrada é invertível quando:'
const NEWTON = 'A segunda lei de Newton relaciona força, massa e:'
const ESSAY_LIMITS = 'Explique com suas palavras o que significa dizer que uma função é contínua em um ponto, e dê um exemplo de função que não seja.'

/** Substrings that remain visible even when the preview truncates the statement. */
const OBJETIVAS = [
  { hint: 'sen(x)/x' },
  { hint: 'derivada' },
  { hint: 'matriz quadrada' },
  { hint: 'Newton' }
] as const
const DISCURSIVAS = [{ hint: 'Explique com suas palavras' }] as const
const ALL_QUESTIONS = [...OBJETIVAS, ...DISCURSIVAS] as const

/**
 * Swap button for the row identified by the statement.
 * Index is only for order.
 */
function swapButtonOf(hint: string) {
  return cy
    .contains('[role="dialog"] ul li', hint)
    .find('[aria-label^="Trocar a questão"]')
}

function addFromBank(...statements: readonly string[]): void {
  cy.contains('button', 'Adicionar do banco').click()
  cy.get('[role="dialog"]').within(() => {
    statements.forEach((statement) => {
      cy.get(`[aria-label="${statement}"]`).check()
    })
    cy.contains('button', 'Adicionar selecionadas').click()
  })
  cy.get('[role="dialog"]').should('not.exist')
}

function seedData() {
  const altLimits = crypto.randomUUID()
  const altDerivative = crypto.randomUUID()
  const altMatrix = crypto.randomUUID()
  const altNewton = crypto.randomUUID()

  const questions = [
    {
      type: 'objetiva',
      statement: LIMITS,
      tags: ['Limites'],
      alternatives: [
        { id: altLimits, text: '1' },
        { id: crypto.randomUUID(), text: '0' }
      ],
      correctAlternativeId: altLimits,
      allowShuffleAlternatives: false
    },
    {
      type: 'objetiva',
      statement: DERIVATIVE,
      tags: ['Derivadas'],
      alternatives: [
        { id: altDerivative, text: '3x²' },
        { id: crypto.randomUUID(), text: '2x' }
      ],
      correctAlternativeId: altDerivative,
      allowShuffleAlternatives: true
    },
    {
      type: 'objetiva',
      statement: MATRIX,
      tags: ['Álgebra Linear'],
      alternatives: [
        { id: altMatrix, text: 'O determinante é diferente de zero' },
        { id: crypto.randomUUID(), text: 'O determinante é zero' }
      ],
      correctAlternativeId: altMatrix,
      allowShuffleAlternatives: true
    },
    {
      type: 'objetiva',
      statement: NEWTON,
      tags: ['Física'],
      alternatives: [
        { id: altNewton, text: 'Aceleração' },
        { id: crypto.randomUUID(), text: 'Velocidade' }
      ],
      correctAlternativeId: altNewton,
      allowShuffleAlternatives: true
    },
    {
      type: 'discursiva',
      statement: ESSAY_LIMITS,
      tags: ['Conceitos'],
      maxScore: 2,
      allowShuffleAlternatives: false
    }
  ]

  cy.request<{ accessToken: string }>('POST', '/api/auth/refresh').then((response) => {
    const token = response.body.accessToken
    const headers = { Authorization: `Bearer ${token}` }

    cy.wrap(questions).each((q) => {
      cy.request({
        method: 'POST',
        url: '/api/questions',
        headers,
        body: q,
      })
    })

    cy.request<{ items: Array<{ id: string; statement: string }> }>({
      method: 'GET',
      url: '/api/questions',
      headers
    }).then((res) => {
      const bank = res.body.items
      const findId = (statement: string) => bank.find((q) => q.statement === statement)?.id

      const limitId = findId(LIMITS)
      const derivId = findId(DERIVATIVE)
      const matrixId = findId(MATRIX)
      const newtonId = findId(NEWTON)
      const essayId = findId(ESSAY_LIMITS)

      const examActive = {
        title: 'Cálculo I — Prova 1',
        description: 'Limites e derivadas',
        shuffleQuestions: true,
        questions: [
          { questionId: limitId, score: 2.5, position: 1 },
          { questionId: derivId, score: 2.5, position: 2 },
          { questionId: essayId, score: 2.5, position: 3 },
        ]
      }

      const examArchived = {
        title: 'Física II — Teste rápido',
        description: 'Leis de Newton',
        shuffleQuestions: false,
        questions: [ { questionId: newtonId, score: 5, position: 1 } ]
      }

      const examPast = {
        title: 'Cálculo I — Prova 1 (2025/2)',
        description: 'Limites e derivadas',
        shuffleQuestions: true,
        questions: [ { questionId: matrixId, score: 5, position: 1 } ]
      }

      cy.request({ method: 'POST', url: '/api/exams', headers, body: examActive })
      cy.request({ method: 'POST', url: '/api/exams', headers, body: examArchived })
      cy.request({ method: 'POST', url: '/api/exams', headers, body: examPast }).then(() => {
         cy.request<{ items: Array<{ id: string; title: string }> }>({
           method: 'GET',
           url: '/api/exams',
           headers
         }).then((examsRes) => {
            const archived = examsRes.body.items.find((e) => e.title === 'Física II — Teste rápido')
            if (archived) {
               cy.request({
                 method: 'DELETE',
                 url: `/api/exams/${archived.id}`,
                 headers
               })
            }
         })
      })
    })
  })
}

describe('lista de provas', () => {
  before(() => {
    cy.signInAsNewTeacher()
    seedData()
  })

  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('h1', 'Provas', { timeout: 10000 }).should('be.visible')
  })

  it('lista as provas semeadas com a pontuação somada', () => {
    cy.contains('a', 'Cálculo I — Prova 1')
      .closest('li')
      .should('contain', '3/20 questões')
      .and('contain', 'pontuação total 7.5')
  })

  it('separa ativas de arquivadas', () => {
    cy.contains('Cálculo I — Prova 1 (2025/2)').should('not.exist')

    cy.chooseSegment('Arquivadas')

    cy.contains('Cálculo I — Prova 1 (2025/2)').should('be.visible')
    cy.contains('Física II — Teste rápido').should('not.exist')
  })

  it('busca pelo título', () => {
    cy.get('[aria-label="Buscar provas"]').type('Física')

    cy.contains('Física II — Teste rápido').should('be.visible')
    cy.contains('Álgebra Linear — Prova 1').should('not.exist')
  })

  it('distingue busca sem resultado de nenhuma prova ainda', () => {
    cy.get('[aria-label="Buscar provas"]').type('zzzz')

    cy.contains('h3', 'Nenhuma prova encontrada').should('be.visible')
    cy.contains('h3', 'Nenhuma prova ainda').should('not.exist')
  })

  it('arquiva e restaura sem perder a prova', () => {
    cy.contains('Física II — Teste rápido').closest('li').contains('button', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()
    cy.contains('Física II — Teste rápido').should('not.exist')

    cy.chooseSegment('Arquivadas')
    cy.contains('Física II — Teste rápido').closest('li').contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()

    cy.chooseSegment('Ativas')
    cy.contains('Física II — Teste rápido').should('be.visible')
  })

  it('duplica abrindo a cópia para edição, sem tocar na original', () => {
    cy.contains('Física II — Teste rápido').closest('li').contains('button', 'Duplicar').click()

    cy.location('pathname').should('match', /\/provas\/.+\/editar$/)
    cy.findByLabel('Título').should('have.value', 'Física II — Teste rápido (cópia)')

    /** Returns to the list using the navigation link, without choosing by index. */
    cy.contains('a', 'Provas').click()
    cy.contains('a', 'Física II — Teste rápido').should('be.visible')
  })

  it('não oferece duplicar numa prova arquivada', () => {
    cy.chooseSegment('Arquivadas')

    cy.contains('Cálculo I — Prova 1 (2025/2)')
      .closest('li')
      .within(() => {
        cy.contains('button', 'Duplicar').should('not.exist')
        cy.contains('button', 'Restaurar').should('be.visible')
      })
  })
})

describe('detalhe da prova', () => {
  before(() => {
    cy.signInAsNewTeacher()
    seedData()
  })

  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('a', 'Cálculo I — Prova 1').click()
    cy.contains('h1', 'Cálculo I — Prova 1', { timeout: 10000 }).should('be.visible')
  })

  it('mostra as questões na ordem, com a pontuação de cada uma', () => {
    cy.get('ol li').should('have.length', 3)
    cy.get('ol li').first().should('contain', 'sen(x)/x').and('contain', '2.5 pontos')
    cy.get('ol li').last().should('contain', 'Explique com suas palavras')
  })

  it('mostra as preferências que a aplicação vai herdar', () => {
    cy.contains('Embaralhar questões: sim').should('be.visible')
  })

  it('leva a aplicar esta prova, que é o passo seguinte', () => {
    cy.contains('Nova aplicação com esta prova').should('be.visible')
  })
})

describe('formulário de prova', () => {
  before(() => {
    cy.signInAsNewTeacher()
    seedData()
  })

  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('a', 'Nova prova').click()
    cy.contains('h1', 'Nova prova', { timeout: 10000 }).should('be.visible')
  })

  it('recusa uma prova com o mesmo título de outra', () => {
    cy.findByLabel('Título').type('Cálculo I — Prova 1')
    cy.contains('button', 'Salvar prova').click()

    cy.contains('Já existe uma prova com estes dados').should('be.visible')
  })

  it('exige título', () => {
    cy.contains('button', 'Salvar prova').click()

    cy.contains('Informe o título da prova').should('be.visible')
  })

  it('adiciona do banco pelo painel lateral e soma a pontuação ao vivo', () => {
    cy.findByLabel('Título').type('Prova de recuperação')
    addFromBank(LIMITS)

    cy.contains('1/20 questões · pontuação total 1').should('be.visible')

    cy.contains('button', 'Salvar prova').click()
    cy.contains('h1', 'Prova de recuperação').should('be.visible')
  })

  it('monta uma prova com 5 questões e pontuação diferente em cada', () => {
    cy.findByLabel('Título').type('Prova com cinco questões')
    addFromBank(LIMITS, DERIVATIVE, MATRIX, NEWTON, ESSAY_LIMITS)

    const scores = ['1', '2', '3', '2.5', '1.5']
    scores.forEach((score, index) => {
      cy.get(`[aria-label="Pontuação da questão ${index + 1} de 5"]`).clear().type(score)
    })

    cy.contains('5/20 questões · pontuação total 10').should('be.visible')
    cy.contains('button', 'Salvar prova').click()
    cy.contains('h1', 'Prova com cinco questões').should('be.visible')
    cy.contains('pontuação total 10').should('be.visible')
  })

  it('salva mesmo quando a pontuação não fecha em 10', () => {
    cy.findByLabel('Título').type('Prova que não fecha')
    addFromBank(LIMITS)

    cy.contains('button', 'Salvar prova').click()

    cy.contains('h1', 'Prova que não fecha').should('be.visible')
  })

  it('não oferece de novo a questão que já está na prova', () => {
    addFromBank(LIMITS)
    cy.contains('button', 'Adicionar do banco').click()

    cy.get('[role="dialog"]').should('not.contain', 'sen(x)/x')
  })

  it('reordena pelos botões', () => {
    addFromBank(LIMITS, DERIVATIVE)
    cy.get('ol li').first().should('contain', 'sen(x)/x')

    cy.get('[aria-label="Mover para baixo a questão 1 de 2"]').click()

    cy.get('ol li').first().should('not.contain', 'sen(x)/x')
    cy.get('ol li').last().should('contain', 'sen(x)/x')
  })

  it('desabilita subir na primeira e descer na última', () => {
    addFromBank(LIMITS, DERIVATIVE)

    cy.get('[aria-label="Mover para cima a questão 1 de 2"]').should('be.disabled')
    cy.get('[aria-label="Mover para baixo a questão 2 de 2"]').should('be.disabled')
  })

  it('remove uma questão da prova sem tocar no banco', () => {
    addFromBank(LIMITS)
    cy.get('[aria-label="Remover a questão 1 de 1"]').click()
    cy.contains('0/20 questões').should('be.visible')

    cy.visit('/questoes')
    cy.contains('sen(x)/x').should('be.visible')
  })

  it('mantém as questões escolhidas ao reabrir para edição', () => {
    cy.findByLabel('Título').type('Prova que volta igual')
    addFromBank(LIMITS)
    cy.contains('button', 'Salvar prova').click()

    cy.contains('a', 'Editar').click()

    cy.contains('1/20 questões').should('be.visible')
    cy.get('ol li').should('contain', 'sen(x)/x')
  })
})

describe('geração automática', () => {
  before(() => {
    cy.signInAsNewTeacher()
    seedData()
  })

  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('a', 'Gerar automaticamente').click()
  })

  it('abre já com o diálogo de geração', () => {
    cy.findInDialog('h2', 'Gerar prova automaticamente').should('be.visible')
  })

  it('não deixa sortear enquanto o banco não chegou', () => {
    cy.findInDialog('button', 'Gerar seleção').should('be.disabled')

    cy.contains('questões disponíveis com estes filtros').should('be.visible')

    cy.findInDialog('button', 'Gerar seleção').should('not.be.disabled')
  })

  it('só libera usar a seleção depois de gerar', () => {
    cy.contains('questões disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Usar esta seleção').should('be.disabled')

    cy.findInDialog('button', 'Gerar seleção').click()

    cy.findInDialog('button', 'Usar esta seleção').should('not.be.disabled')
  })

  it('avisa quando o banco não tinha tudo que foi pedido, em vez de falhar', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="status"]').should('contain', 'O banco não tinha tudo que você pediu')
  })

  it('filtra por tag antes de sortear', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length', 1).and('contain', 'matriz quadrada')
  })

  it('troca uma questão sorteada por outra do mesmo tipo', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[aria-label="Quantas objetivas"]').clear().type('2')
    cy.findInDialog('button', 'Gerar seleção').click()
    cy.get('[role="dialog"] ul li').should('have.length', 2)

    /** Identifies one of the objective questions drawn by the statement, instead of choosing the row by index. */
    cy.get('[role="dialog"] ul li').then(($lis) => {
      const drawn = OBJETIVAS.find((q) => $lis.text().includes(q.hint))
      if (!drawn) throw new Error('Nenhuma objetiva conhecida na prévia')

      swapButtonOf(drawn.hint).click()

      cy.get('[role="dialog"] ul li').should('have.length', 2)
      cy.contains('[role="dialog"] ul li', drawn.hint).should('not.exist')
    })
  })

  it('inclui discursivas quando pedido', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[aria-label="Quantas objetivas"]').clear().type('1')
    cy.findInDialog('span', 'Incluir discursivas').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length', 2)
  })

  it('não sorteia discursiva quando não foi pedida', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[aria-label="Quantas objetivas"]').clear().type('4')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('not.contain', 'Explique com suas palavras')
  })

  it('diz que não há substituta quando o banco se esgotou', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    /** The row is identified by the statement, not by index. */
    cy.contains('[role="dialog"] ul li', 'matriz quadrada')
      .find('[aria-label^="Trocar a questão"]')
      .click()

    cy.get('[role="status"]').should('contain', 'Não há outra questão do mesmo tipo')
  })

  it('remove da prévia sem sortear de novo', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    /** Identifies a known question from the preview by the statement and removes it. */
    cy.get('[role="dialog"] ul li').then(($lis) => {
      const drawn = ALL_QUESTIONS.find((q) => $lis.text().includes(q.hint))
      if (!drawn) throw new Error('Nenhuma questão conhecida na prévia')

      cy.contains('[role="dialog"] ul li', drawn.hint)
        .find('[aria-label^="Remover a questão"]')
        .click()

      cy.get('[role="dialog"] ul li').should('have.length', $lis.length - 1)
    })
  })

  it('leva a prévia para o formulário ao confirmar', () => {
    cy.contains('5 questões disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()
    cy.findInDialog('button', 'Usar esta seleção').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('questões · pontuação total').should('be.visible')
  })
})
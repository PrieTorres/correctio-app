import type { ExamInput, QuestionInput } from '@/lib/schemas'
import { apiAs, type SignedInTeacher } from '../support/commands'

/**
 * Exam composition: the bank turned into something that can be applied.
 *
 * Nothing here touches a class or a date. The exam is the content and the
 * application is the event, and that separation is what lets the same exam
 * serve several classes and several terms.
 */

/**
 * Seeded statements, named rather than taken by position.
 *
 * The bank is sorted by statement, so an index says nothing about which
 * question it is and silently points somewhere else the moment the seed
 * changes.
 */
const LIMITS = 'Qual é o valor de lim(x→0) sen(x)/x?'
const DERIVATIVE = 'A derivada de f(x) = x³ é:'
const MATRIX = 'Uma matriz quadrada é invertível quando:'
const NEWTON = 'A segunda lei de Newton relaciona força, massa e:'
const ESSAY_LIMITS = 'Explique com suas palavras o que significa dizer que uma função é contínua em um ponto, e dê um exemplo de função que não seja.'

/** The multiple-choice questions of the sample, the only ones a draw of objectives can bring. */
const OBJECTIVES: readonly string[] = [LIMITS, DERIVATIVE, MATRIX, NEWTON]

/** What the app shows for any server failure, whatever the server said: the detail stays in the API log. */
const SERVER_DOWN = 'Não foi possível falar com o servidor. Tente de novo em instantes.'

const FAILURE = { statusCode: 500, body: { code: 'failure', message: 'Erro inesperado.' } }

const SWAP_PREFIX = 'Trocar a questão '

/** The statements in the draw's preview, read from the names of their swap buttons, which carry them whole. */
function drawnStatements(): Cypress.Chainable<string[]> {
  return cy
    .get(`[role="dialog"] [aria-label^="${SWAP_PREFIX}"]`)
    .then(($buttons) => $buttons.toArray().map((button) => (button.getAttribute('aria-label') ?? '').slice(SWAP_PREFIX.length)))
}

/** Ticks the named questions in the picker and confirms. */
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

describe('lista de provas', () => {
  beforeEach(() => cy.visit('/provas'))

  it('lista as provas semeadas com a pontuação somada', () => {
    cy.contains('h1', 'Provas').should('be.visible')
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

    cy.visit('/provas')
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

/** A teacher with nothing yet stands for the empty system; the support file's teacher has the sample. */
describe('lista de provas vazia', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.signInAsNewTeacher({ withSampleData: false })
    cy.visit('/provas')
  })

  it('explica o que é uma prova quando não existe nenhuma', () => {
    cy.contains('h3', 'Nenhuma prova ainda').should('be.visible')
    cy.contains('A mesma prova serve para várias turmas').should('be.visible')
    cy.contains('h3', 'Nenhuma prova encontrada').should('not.exist')
  })

  it('diz que arquivar é reversível quando nenhuma prova foi arquivada', () => {
    cy.chooseSegment('Arquivadas')

    cy.contains('h3', 'Nenhuma prova arquivada').should('be.visible')
    cy.contains('é reversível a qualquer momento').should('be.visible')
  })
})

describe('detalhe da prova', () => {
  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('a', 'Cálculo I — Prova 1').click()
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
  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('a', 'Nova prova').click()
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

  /**
   * Driven with pointer events rather than a keyboard, because dnd-kit decides
   * where a drag lands from measured positions: it needs a real pointer moving
   * past the activation distance and over the row it should displace.
   */
  it('reordena arrastando pela alça', () => {
    addFromBank(LIMITS, DERIVATIVE)
    cy.get('ol li').first().should('contain', 'sen(x)/x')

    cy.contains('li', DERIVATIVE).then(($target) => {
      const { top, height } = $target.get(0).getBoundingClientRect()
      const landing = top + height / 2

      cy.get('[aria-label="Arrastar a questão 1 de 2"]').trigger('pointerdown', {
        button: 0,
        isPrimary: true,
        eventConstructor: 'PointerEvent',
      })
      cy.get('body')
        .trigger('pointermove', { clientX: 20, clientY: landing - 40, eventConstructor: 'PointerEvent' })
        .trigger('pointermove', { clientX: 20, clientY: landing, eventConstructor: 'PointerEvent' })
        .trigger('pointerup', { eventConstructor: 'PointerEvent' })
    })

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

  /** A refused save keeps what was built: losing the questions over a failure of the server would cost the work again. */
  it('mostra a falha do servidor ao salvar, sem perder o que foi montado', () => {
    cy.intercept({ method: 'POST', pathname: '/api/exams' }, FAILURE)
    cy.findByLabel('Título').type('Prova que não salvou')
    addFromBank(LIMITS)

    cy.contains('button', 'Salvar prova').click()

    cy.contains('[role="alert"]', SERVER_DOWN).should('be.visible')
    cy.contains('h1', 'Nova prova').should('be.visible')
    cy.contains('1/20 questões').should('be.visible')
    cy.findByLabel('Título').should('have.value', 'Prova que não salvou')
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

/** The most questions an exam takes (RF15). */
const MAX_QUESTIONS = 20

/**
 * An exam one question short of the limit, made on the API from questions of
 * its own: building it on screen would take nineteen trips to the drawer. The
 * sample questions stay out of it, so the drawer still has some to offer.
 */
function createExamOneShortOfTheLimit(title: string): void {
  cy.get<SignedInTeacher>('@teacher').then(({ accessToken }) => {
    const api = apiAs(accessToken)
    const questionIds: string[] = []

    Cypress._.times(MAX_QUESTIONS - 1, (index) => {
      const question: QuestionInput = {
        type: 'discursiva',
        statement: `Questão de reserva ${index + 1}`,
        tags: ['Reserva'],
        maxScore: 1,
        allowShuffleAlternatives: true,
      }
      api<{ id: string }>('POST', '/questions', question).then(({ body }) => questionIds.push(body.id))
    })

    cy.wrap(null, { log: false }).then(() => {
      const exam: ExamInput = {
        title,
        description: '',
        questions: questionIds.map((questionId, order) => ({ questionId, order, score: 1, allowShuffleAlternatives: true })),
        defaultShuffleQuestions: true,
        defaultShuffleAlternatives: true,
      }
      return api('POST', '/exams', exam)
    })
  })
}

describe('limite de questões', () => {
  /**
   * RF15: the drawer lets the teacher tick only what still fits, and both ways
   * of adding stop at twenty, instead of dropping the extra ones in silence.
   * The exam is reopened through the app's own links.
   */
  it('para de aceitar questões ao chegar em 20 e salva a prova cheia', () => {
    createExamOneShortOfTheLimit('Prova no limite')
    cy.visit('/provas')
    cy.contains('a', 'Prova no limite').click()
    cy.contains('a', 'Editar').click()
    cy.contains(`${MAX_QUESTIONS - 1}/${MAX_QUESTIONS} questões`).should('be.visible')

    cy.contains('button', 'Adicionar do banco').click()
    cy.get('[role="dialog"]').should('contain', 'cabem mais 1 nesta prova')
    cy.get(`[aria-label="${LIMITS}"]`).check()
    cy.get(`[aria-label="${DERIVATIVE}"]`).should('be.disabled')
    cy.findInDialog('button', 'Adicionar selecionadas').click()
    cy.get('[role="dialog"]').should('not.exist')

    cy.contains(`${MAX_QUESTIONS}/${MAX_QUESTIONS} questões · pontuação total ${MAX_QUESTIONS}`).should('be.visible')
    cy.contains('button', 'Adicionar do banco').should('be.disabled')
    cy.contains('button', 'Preencher automaticamente').should('be.disabled')

    cy.contains('button', 'Salvar prova').click()
    cy.contains('h1', 'Prova no limite').should('be.visible')
  })
})

describe('geração automática', () => {
  beforeEach(() => {
    cy.visit('/provas')
    cy.contains('a', 'Gerar automaticamente').click()
  })

  it('abre já com o diálogo de geração', () => {
    cy.findInDialog('h2', 'Gerar prova automaticamente').should('be.visible')
  })

  /**
   * The screen opens straight into this dialog, so it is normally on screen
   * before the bank has arrived. Drawing then finds nothing and blames the
   * bank for being short, which is the one thing that is not true.
   *
   * The bank comes from the API, which on the same machine answers before the
   * first check, so its answer is held back here: the test needs the moment
   * before it arrives to exist on every run.
   */
  it('não deixa sortear enquanto o banco não chegou', () => {
    cy.intercept({ method: 'GET', pathname: '/api/questions' }, (req) => {
      req.on('response', (res) => {
        res.setDelay(1500)
      })
    })
    cy.visit('/provas')
    cy.contains('a', 'Gerar automaticamente').click()

    cy.findInDialog('button', 'Gerar seleção').should('be.disabled')

    cy.contains('disponíveis com estes filtros').should('be.visible')

    cy.findInDialog('button', 'Gerar seleção').should('not.be.disabled')
  })

  it('só libera usar a seleção depois de gerar', () => {
    cy.contains('disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Usar esta seleção').should('be.disabled')

    cy.findInDialog('button', 'Gerar seleção').click()

    cy.findInDialog('button', 'Usar esta seleção').should('not.be.disabled')
  })

  it('avisa quando o banco não tinha tudo que foi pedido, em vez de falhar', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="status"]').should('contain', 'O banco não tinha tudo que você pediu')
  })

  it('filtra por tag antes de sortear', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length', 1).and('contain', 'matriz quadrada')
  })

  /**
   * No sample question carries both the linear algebra tag and the physics
   * one. A draw that wanted every tag found none and said the bank was short;
   * a question needs only one of the tags marked.
   */
  it('sorteia as questões que têm qualquer uma das tags marcadas', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.contains('Entram as questões com pelo menos uma das tags marcadas.').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.get('[role="dialog"]').contains('label', 'Física II').click()
    cy.contains('2 objetivas').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"]').should('contain', 'matriz quadrada').and('contain', 'A segunda lei de Newton')
  })

  /**
   * Two of the four multiple-choice questions are drawn, so the bank still has
   * spares. Asking for all of them leaves nothing to swap to, which is the
   * case the test after the next covers.
   *
   * The draw is random, so which question is swapped does not matter; what
   * matters is that the test follows that one by its statement, held in a
   * plain variable rather than an alias, which would be read again after the
   * click and compare the preview with itself.
   */
  it('troca uma questão sorteada por outra do mesmo tipo', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"] [aria-label="Quantas objetivas"]').clear().type('2')
    cy.findInDialog('button', 'Gerar seleção').click()
    cy.get(`[role="dialog"] [aria-label^="${SWAP_PREFIX}"]`).should('have.length', 2)

    drawnStatements().then(([swapped]) => {
      if (swapped === undefined) throw new Error('O sorteio não trouxe nenhuma questão.')
      cy.get(`[aria-label="${SWAP_PREFIX}${swapped}"]`).click()

      cy.get(`[aria-label="${SWAP_PREFIX}${swapped}"]`).should('not.exist')
      cy.get(`[role="dialog"] [aria-label^="${SWAP_PREFIX}"]`).should('have.length', 2)
      drawnStatements().then((after) => {
        expect(after.every((statement) => OBJECTIVES.includes(statement)), 'só objetivas na prévia').to.equal(true)
      })
    })
  })

  /** #178: the open-ended ones only count when they are asked for, since otherwise the draw leaves them out. */
  it('conta só os tipos que vão ser sorteados', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')

    cy.findInDialog('span', 'Incluir discursivas').click()

    cy.contains('4 objetivas e 2 discursivas disponíveis com estes filtros').should('be.visible')
  })

  it('inclui discursivas quando pedido', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"] [aria-label="Quantas objetivas"]').clear().type('1')
    cy.findInDialog('span', 'Incluir discursivas').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length', 2)
  })

  it('não sorteia discursiva quando não foi pedida', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"] [aria-label="Quantas objetivas"]').clear().type('4')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('not.contain', 'Explique com suas palavras')
  })

  it('diz que não há substituta quando o banco se esgotou', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get(`[aria-label="${SWAP_PREFIX}${MATRIX}"]`).click()

    cy.get('[role="status"]').should('contain', 'Não há outra questão do mesmo tipo')
  })

  /** Five are asked of a bank with four multiple-choice questions, so all four are drawn and the test knows each by name. */
  it('remove da prévia sem sortear de novo', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()
    cy.get(`[role="dialog"] [aria-label^="${SWAP_PREFIX}"]`).should('have.length', OBJECTIVES.length)

    cy.get(`[aria-label="Remover a questão ${LIMITS}"]`).click()

    cy.get(`[aria-label="${SWAP_PREFIX}${LIMITS}"]`).should('not.exist')
    cy.get(`[role="dialog"] [aria-label^="${SWAP_PREFIX}"]`).should('have.length', OBJECTIVES.length - 1)
  })

  it('leva a prévia para o formulário ao confirmar', () => {
    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()
    cy.findInDialog('button', 'Usar esta seleção').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('questões · pontuação total').should('be.visible')
  })
})

/**
 * A bank bigger than one page, without creating fifty questions: a request
 * for a single page of 50 answers as if every sample question sat on a later
 * page. An exam can use any question of the bank, so its screens must find
 * them wherever they fall in the paged list.
 */
function pushSampleQuestionsPastFirstPage() {
  cy.intercept({ method: 'GET', pathname: '/api/questions', query: { pageSize: '50' } }, (req) => {
    req.continue((res) => {
      const page: unknown = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
      const total = typeof page === 'object' && page !== null && 'total' in page ? Number(page.total) : 0
      res.send({ items: [], total: total + 50 })
    })
  })
}

describe('banco maior que uma página', () => {
  beforeEach(() => {
    pushSampleQuestionsPastFirstPage()
    cy.visit('/provas')
  })

  it('o detalhe da prova acha as questões que não estão na primeira página', () => {
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.get('ol li').first().should('contain', 'sen(x)/x')
    cy.contains('Questão removida do banco').should('not.exist')
  })

  it('a edição mantém as questões que não estão na primeira página', () => {
    cy.contains('a', 'Cálculo I — Prova 1').click()
    cy.contains('a', 'Editar').click()

    cy.contains('3/20 questões').should('be.visible')
    cy.get('ol li').first().should('contain', 'sen(x)/x')
    cy.contains('Questão removida do banco').should('not.exist')
  })

  it('o sorteio enxerga o banco inteiro', () => {
    cy.contains('a', 'Gerar automaticamente').click()

    cy.contains('4 objetivas disponíveis com estes filtros').should('be.visible')
  })
})

/** The access token of the teacher this spec signed up, read the way the app restores its own session. */
function accessToken(): Cypress.Chainable<string> {
  return cy.request<{ accessToken: string }>('POST', '/api/auth/refresh').then(({ body }) => body.accessToken)
}

describe('provas na API', () => {
  /**
   * The draw runs on the server and leaves out the exam's questions, so
   * filling an exam already started never brings one of them back.
   */
  it('preenche automaticamente sem repetir questão que já está na prova', () => {
    cy.visit('/provas')
    cy.contains('a', 'Nova prova').click()
    cy.findByLabel('Título').type('Prova começada')
    addFromBank(LIMITS)

    cy.contains('button', 'Preencher automaticamente').click()
    cy.contains('disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length.greaterThan', 0)
    cy.get('[role="dialog"] ul').should('not.contain', 'sen(x)/x')
  })

  /** RF13: deleting a question takes it out of the bank, never out of the exams that already use it. */
  it('o detalhe mostra o enunciado de uma questão excluída do banco depois', () => {
    accessToken().then((token) => {
      cy.request<{ items: { id: string; statement: string }[] }>({
        url: '/api/questions?pageSize=1000',
        auth: { bearer: token },
      }).then(({ body }) => {
        const limits = body.items.find((item) => item.statement === LIMITS)
        if (limits === undefined) throw new Error('A questão de exemplo de limites não está no banco.')
        cy.request({ method: 'DELETE', url: `/api/questions/${limits.id}`, auth: { bearer: token } })
      })
    })

    cy.visit('/provas')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.get('ol li').first().should('contain', 'sen(x)/x')
    cy.contains('Questão removida do banco').should('not.exist')
  })

  /** The exam an application was generated from is marked on the server, so the list shows it as applied. */
  it('mostra como aplicada a prova de exemplo que já tem aplicação', () => {
    cy.visit('/provas')

    cy.contains('a', 'Cálculo I — Prova 1').parents('li').first().should('contain', 'Aplicada')
  })
})

/**
 * The automatic exam spreads its questions over the tags marked: one of each
 * content before a second of any, and a swap keeps the content of the
 * question going out. The bank is the test's own, with three questions of
 * Limites and one of Matrizes, so a draw that ignored the balance would often
 * bring two of Limites.
 */
describe('geração automática equilibrada entre as tags', () => {
  const LIMITS = ['Limites A', 'Limites B', 'Limites C']

  beforeEach(() => {
    cy.clearCookies()
    cy.signInAsNewTeacher({ withSampleData: false }).then(({ accessToken }) => {
      const api = apiAs(accessToken)
      const objective = (statement: string, tag: string): QuestionInput => {
        const right = crypto.randomUUID()
        return {
          type: 'objetiva',
          statement,
          tags: [tag],
          alternatives: [
            { id: right, text: 'certa' },
            { id: crypto.randomUUID(), text: 'errada' },
          ],
          correctAlternativeId: right,
          allowShuffleAlternatives: true,
        }
      }
      for (const statement of LIMITS) api('POST', '/questions', objective(statement, 'Limites'))
      api('POST', '/questions', objective('Matrizes A', 'Matrizes'))
    })
    cy.visit('/provas')
    cy.contains('a', 'Gerar automaticamente').click()
    cy.contains('disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Limites').click()
    cy.get('[role="dialog"]').contains('label', 'Matrizes').click()
    cy.get('[aria-label="Quantas objetivas"]').clear().type('2')
    cy.findInDialog('button', 'Gerar seleção').click()
  })

  it('sorteia uma questão de cada tag marcada antes de repetir uma tag', () => {
    cy.get('[role="dialog"] ul li').should('have.length', 2)
    cy.get('[role="dialog"] ul').should('contain', 'Matrizes A').and('contain', 'Limites')
  })

  it('troca uma questão por outra do mesmo conteúdo', () => {
    cy.get('[role="dialog"] ul')
      .contains('li', 'Limites')
      .invoke('text')
      .then((text) => {
        const statement = LIMITS.find((item) => text.includes(item)) ?? ''
        cy.get(`[aria-label="Trocar a questão ${statement}"]`).click()

        cy.get('[role="dialog"] ul').should('not.contain', statement).and('contain', 'Matrizes A')
        cy.get('[role="dialog"] ul').contains('li', 'Limites').should('exist')
      })
  })
})

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

/** The swap control of the first previewed question, scoped to that row. */
function swapButtonOfFirstRow() {
  return cy
    .get('[role="dialog"] ul li')
    .first()
    .find('button[aria-label^="Trocar a questão"]')
}

/** Ticks the named questions in the picker and confirms. */
function addFromBank(...statements: readonly string[]): void {
  cy.contains('button', 'Adicionar do banco').click()
  cy.get('[role="dialog"]').within(() => {
    statements.forEach((statement) => {
      cy.get(`input[aria-label="${statement}"]`).check()
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
    cy.get('input[type="search"]').type('Física')

    cy.contains('Física II — Teste rápido').should('be.visible')
    cy.contains('Álgebra Linear — Prova 1').should('not.exist')
  })

  it('distingue busca sem resultado de nenhuma prova ainda', () => {
    cy.get('input[type="search"]').type('zzzz')

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
      cy.get(`input[aria-label="Pontuação da questão ${index + 1} de 5"]`).clear().type(score)
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

    cy.get('button[aria-label="Mover para baixo a questão 1 de 2"]').click()

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

    cy.get('ol li')
      .eq(1)
      .then(($target) => {
        const { top, height } = $target[0].getBoundingClientRect()
        const landing = top + height / 2

        cy.get('button[aria-label="Arrastar a questão 1 de 2"]').trigger('pointerdown', {
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

    cy.get('button[aria-label="Mover para cima a questão 1 de 2"]').should('be.disabled')
    cy.get('button[aria-label="Mover para baixo a questão 2 de 2"]').should('be.disabled')
  })

  it('remove uma questão da prova sem tocar no banco', () => {
    addFromBank(LIMITS)
    cy.get('button[aria-label="Remover a questão 1 de 1"]').click()
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
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="status"]').should('contain', 'O banco não tinha tudo que você pediu')
  })

  it('filtra por tag antes de sortear', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length', 1).and('contain', 'matriz quadrada')
  })

  /**
   * Two of the four multiple-choice questions are drawn, so the bank still has
   * spares. Asking for all of them leaves nothing to swap to, which is the
   * case the next test covers.
   *
   * The label is held in a plain variable, not an alias. An alias made from a
   * query is re-run when it is read back, so reading it after the click gave
   * the label the row had by then and the assertion compared it with itself.
   */
  it('troca uma questão sorteada por outra do mesmo tipo', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"] input[aria-label="Quantas objetivas"]').clear().type('2')
    cy.findInDialog('button', 'Gerar seleção').click()
    cy.get('[role="dialog"] ul li').should('have.length', 2)

    swapButtonOfFirstRow()
      .invoke('attr', 'aria-label')
      .then((before) => {
        swapButtonOfFirstRow().click()

        swapButtonOfFirstRow().should('not.have.attr', 'aria-label', before)
        cy.get('[role="dialog"] ul li').should('have.length', 2)
      })
  })

  it('inclui discursivas quando pedido', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"] input[aria-label="Quantas objetivas"]').clear().type('1')
    cy.findInDialog('span', 'Incluir discursivas').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('have.length', 2)
  })

  it('não sorteia discursiva quando não foi pedida', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"] input[aria-label="Quantas objetivas"]').clear().type('4')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').should('not.contain', 'Explique com suas palavras')
  })

  it('diz que não há substituta quando o banco se esgotou', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.get('[role="dialog"]').contains('label', 'Álgebra Linear').click()
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] button[aria-label^="Trocar a questão"]').first().click()

    cy.get('[role="status"]').should('contain', 'Não há outra questão do mesmo tipo')
  })

  it('remove da prévia sem sortear de novo', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
    cy.findInDialog('button', 'Gerar seleção').click()

    cy.get('[role="dialog"] ul li').then((items) => {
      cy.get('[role="dialog"] button[aria-label^="Remover a questão"]').first().click()
      cy.get('[role="dialog"] ul li').should('have.length', items.length - 1)
    })
  })

  it('leva a prévia para o formulário ao confirmar', () => {
    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
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

    cy.contains('6 questões disponíveis com estes filtros').should('be.visible')
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
    cy.contains('questões disponíveis com estes filtros').should('be.visible')
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

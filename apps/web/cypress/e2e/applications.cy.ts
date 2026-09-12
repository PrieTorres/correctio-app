/**
 * Applications: where an exam meets a class on a date, and paper comes out.
 *
 * The PDF itself is a fixed sample in this phase — rendering one is server
 * work. What has to exist for real are the versions and the sheets, because
 * the public grade lookup reads a sheet by its code.
 */

/** The seeded application that has not been generated yet. */
const TO_GENERATE = 'Física II — Teste rápido'
const ALREADY_GENERATED = 'Cálculo I — Prova 1'

describe('lista de aplicações', () => {
  beforeEach(() => cy.visit('/aplicacoes'))

  it('lista as aplicações semeadas com a turma e a data', () => {
    cy.contains('h1', 'Aplicações').should('be.visible')
    cy.contains('a', ALREADY_GENERATED)
      .closest('li')
      .should('contain', 'Cálculo I — Noturno')
      .and('contain', '05/10/2026')
  })

  it('distingue a que já foi gerada da que ainda não', () => {
    cy.contains('a', ALREADY_GENERATED).closest('li').should('contain', 'Gerada')
    cy.contains('a', TO_GENERATE).closest('li').should('contain', 'A gerar')
  })

  it('separa ativas de arquivadas', () => {
    cy.contains('a', TO_GENERATE).closest('li').contains('button', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()
    cy.contains('a', TO_GENERATE).should('not.exist')

    cy.chooseSegment('Arquivadas')
    cy.contains('a', TO_GENERATE).should('be.visible')
  })

  it('restaura o que foi arquivado', () => {
    cy.contains('a', TO_GENERATE).closest('li').contains('button', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()

    cy.chooseSegment('Arquivadas')
    cy.contains('a', TO_GENERATE).closest('li').contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()

    cy.chooseSegment('Ativas')
    cy.contains('a', TO_GENERATE).should('be.visible')
  })

  it('distingue busca sem resultado de nenhuma aplicação ainda', () => {
    cy.get('input[type="search"]').type('zzzz')

    cy.contains('h3', 'Nenhuma aplicação encontrada').should('be.visible')
    cy.contains('h3', 'Nenhuma aplicação ainda').should('not.exist')
  })
})

describe('criar aplicação', () => {
  beforeEach(() => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Nova aplicação').click()
  })

  it('exige prova e turma', () => {
    cy.contains('button', 'Salvar e gerar').click()

    cy.get('[role="alert"]').should('have.length.at.least', 1)
  })

  it('cria e segue direto para gerar', () => {
    cy.get('#select-prova').select('Álgebra Linear — Prova 1')
    cy.get('#select-turma').select('Álgebra Linear')
    cy.contains('button', 'Salvar e gerar').click()

    cy.contains('h1', 'Gerar prova').should('be.visible')
  })

  it('oferece apenas provas e turmas ativas', () => {
    cy.get('#select-prova').should('not.contain', 'Cálculo I — Prova 1 (2025/2)')
    cy.get('#select-turma').should('not.contain', 'Cálculo I — Matutino')
  })
})

describe('gerar a prova', () => {
  beforeEach(() => {
    cy.visit('/aplicacoes')
    cy.contains('a', TO_GENERATE).click()
    cy.contains('a', 'Gerar').click()
  })

  it('herda o embaralhamento da prova', () => {
    cy.contains('h1', 'Gerar prova').should('be.visible')

    cy.contains('label', 'Embaralhar as questões').find('input').should('not.be.checked')
    cy.contains('label', 'Embaralhar as alternativas').find('input').should('be.checked')
  })

  it('gera as versões pedidas e uma folha por aluno', () => {
    cy.get('input[aria-label="Quantas versões"]').clear().type('3')
    cy.contains('button', 'Gerar').click()

    cy.contains('h1', TO_GENERATE, { timeout: 10000 }).should('be.visible')
    cy.contains('Versão 1').should('be.visible')
    cy.contains('Versão 3').should('be.visible')
    cy.get('table tbody tr').should('have.length', 10)
  })

  it('dá a cada folha um código próprio', () => {
    cy.contains('button', 'Gerar').click()
    cy.contains('h1', TO_GENERATE, { timeout: 10000 }).should('be.visible')

    cy.get('table tbody tr td:last-child').then(($codes) => {
      const values = [...$codes].map((cell) => cell.textContent?.trim())
      expect(new Set(values).size).to.equal(values.length)
    })
  })

  it('avisa antes de substituir papel que já existe', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', ALREADY_GENERATED).click()
    cy.contains('a', 'Gerar de novo').click()

    cy.get('[role="status"]').should('contain', 'substitui')
  })
})

describe('detalhe da aplicação', () => {
  beforeEach(() => {
    cy.visit('/aplicacoes')
    cy.contains('a', ALREADY_GENERATED).click()
  })

  it('explica que o PDF desta fase é um exemplo fixo', () => {
    cy.contains('PDF para impressão').should('be.visible')
    cy.contains('exemplo fixo').should('be.visible')
  })

  it('não oferece baixar quando nada foi gerado', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', TO_GENERATE).click()

    cy.contains('button', 'Baixar PDF de exemplo').should('be.disabled')
  })

  it('mostra as versões e as folhas geradas', () => {
    cy.contains('h2', 'Versões').should('be.visible')
    cy.contains('h2', 'Folhas').should('be.visible')
  })

  it('publica e despublica o gabarito de uma versão', () => {
    cy.contains('button', 'Publicar gabarito').first().click()

    cy.contains('Gabarito publicado').should('be.visible')
    cy.contains('button', 'Despublicar gabarito').first().click()
    cy.contains('Gabarito publicado').should('not.exist')
  })

  it('libera e recolhe a consulta de nota', () => {
    const toggle = () => cy.contains('label', 'Liberar a consulta de nota').find('input')

    /*
      Left through the app's own link rather than `cy.visit`. The write is
      asynchronous, and reloading the page while it is in flight throws it away
      — which is what a person does not do, and what made this look broken.
    */
    toggle().check()
    cy.contains('a', 'Aplicações').click()
    cy.contains('a', ALREADY_GENERATED).closest('li').should('contain', 'Notas liberadas')

    cy.contains('a', ALREADY_GENERATED).click()
    toggle().uncheck()
    cy.contains('a', 'Aplicações').click()
    cy.contains('a', ALREADY_GENERATED).closest('li').should('not.contain', 'Notas liberadas')

    /* Reloading only now, to prove the choice was stored and not only cached. */
    cy.reload()
    cy.contains('a', ALREADY_GENERATED).closest('li').should('not.contain', 'Notas liberadas')
  })

  it('mostra o progresso da correção', () => {
    cy.contains('folhas corrigidas').should('be.visible')
  })
})

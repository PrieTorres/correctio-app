/**
 * Correction: reading the sheets, reviewing what was read, and confirming.
 *
 * The reading is simulated in this phase — there is no server to read an image
 * with, and a phone photo in base64 exceeds the storage available. Everything
 * after the reading is real: the grading, the partial status, and the fact that
 * nothing becomes a grade until the teacher confirms it.
 */
const APPLICATION = 'Cálculo I — Prova 1'

function openGrading() {
  cy.visit('/aplicacoes')
  cy.contains('a', APPLICATION).click()
  cy.contains('a', 'Corrigir folhas').click()
  cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
}

describe('enviar folhas', () => {
  beforeEach(openGrading)

  it('lista as folhas da aplicação e quantas foram lidas', () => {
    cy.contains('h2', 'Folhas desta aplicação').should('be.visible')
    cy.contains('0 de 12 lidas').should('be.visible')
  })

  it('explica que a leitura desta fase é simulada', () => {
    cy.contains('a leitura é simulada').should('be.visible')
  })

  it('não deixa ler sem escolher nenhuma folha', () => {
    cy.contains('button', 'Ler 0 folhas').should('be.disabled')
  })

  it('lê as folhas escolhidas e mostra a nota prévia', () => {
    cy.get('input[aria-label="Marcar a folha 1 para leitura"]').check()
    cy.contains('button', 'Ler 1 folhas').click()

    cy.contains('1 de 12 lidas', { timeout: 10000 }).should('be.visible')
    cy.contains('a', 'Revisar').should('be.visible')
  })

  /** A mixed exam is graded as far as the machine can, and waits for the rest. */
  it('deixa a correção em andamento enquanto falta nota de discursiva', () => {
    cy.get('input[aria-label="Marcar a folha 1 para leitura"]').check()
    cy.contains('button', 'Ler 1 folhas').click()

    cy.contains('Em andamento', { timeout: 10000 }).should('be.visible')
  })

  it('seleciona todas as não lidas de uma vez', () => {
    cy.contains('button', 'Selecionar todas as não lidas').click()

    cy.contains('button', 'Ler 12 folhas').should('not.be.disabled')
  })

  it('leva às pendentes de atribuição', () => {
    cy.contains('a', 'Ver correções pendentes').click()

    cy.contains('h1', 'Pendentes de atribuição').should('be.visible')
  })
})

describe('revisar e confirmar', () => {
  beforeEach(() => {
    openGrading()
    cy.get('input[aria-label="Marcar a folha 1 para leitura"]').check()
    cy.contains('button', 'Ler 1 folhas').click()
    cy.contains('a', 'Revisar', { timeout: 10000 }).first().click()
    cy.contains('h1', 'Folha 1').should('be.visible')
  })

  it('mostra a folha ao lado do que foi lido', () => {
    cy.get('img[alt*="Folha de respostas"]').should('be.visible')
    cy.contains('h2', 'Questões').should('be.visible')
  })

  it('avisa que falta lançar a nota da discursiva', () => {
    cy.get('[role="status"]').should('contain', 'discursiva')
  })

  it('recalcula a nota ao lançar a discursiva', () => {
    cy.get('input[aria-label^="Nota da questão"]').first().clear().type('2.5')

    cy.contains('2.5').should('be.visible')
  })

  it('permite girar e ampliar a folha', () => {
    cy.get('button[aria-label="Girar a folha"]').click()
    cy.get('button[aria-label="Aumentar o zoom"]').click()

    cy.get('img[alt*="Folha de respostas"]').should('be.visible')
  })

  it('confirma a correção e volta para a lista', () => {
    cy.get('input[aria-label^="Nota da questão"]').first().clear().type('2.5')
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('h1', 'Enviar folhas de respostas', { timeout: 10000 }).should('be.visible')
    cy.contains('Corrigida').should('be.visible')
  })
})

describe('relatório da aplicação', () => {
  it('explica que nada foi corrigido ainda', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', APPLICATION).click()
    cy.url().then((url) => {
      const id = url.split('/').pop()
      cy.visit(`/aplicacoes/${id}/relatorio`)
    })

    cy.contains('h3', 'Nada corrigido ainda').should('be.visible')
  })

  it('calcula as estatísticas depois da primeira correção', () => {
    openGrading()
    cy.get('input[aria-label="Marcar a folha 1 para leitura"]').check()
    cy.contains('button', 'Ler 1 folhas').click()
    cy.contains('1 de 12 lidas', { timeout: 10000 }).should('be.visible')

    cy.url().then((url) => {
      const id = url.split('/')[4]
      cy.visit(`/aplicacoes/${id}/relatorio`)
    })

    cy.contains('h1', 'Relatório da aplicação').should('be.visible')
    cy.contains('Média').should('be.visible')
    cy.contains('h2', 'Distribuição das notas').should('be.visible')
    cy.contains('h2', 'Por conteúdo').should('be.visible')
  })
})

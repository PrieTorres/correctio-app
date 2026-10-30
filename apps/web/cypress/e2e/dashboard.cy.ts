/**
 * The panel and the profile: where a term is read at a glance, and where the
 * sessions and the account are managed.
 */
describe('painel', () => {
  beforeEach(() => cy.visit('/painel'))

  it('resume o semestre em números', () => {
    cy.contains('h1', 'Painel').should('be.visible')
    cy.contains('a', 'Turmas').should('be.visible')
    cy.contains('a', 'Questões').should('be.visible')
  })

  /** RNF06: any main action within three clicks of here. */
  it('abre uma nova prova em dois cliques a partir daqui', () => {
    cy.contains('a', 'Nova prova').click()

    cy.contains('h1', 'Nova prova').should('be.visible')
  })

  it('abre uma nova questão a partir dos atalhos', () => {
    cy.contains('a', 'Nova questão').click()

    cy.contains('h1', 'Nova questão').should('be.visible')
  })

  it('abre uma nova aplicação a partir dos atalhos', () => {
    cy.contains('a', 'Nova aplicação').click()

    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  it('mostra a atividade recente e leva ao detalhe', () => {
    cy.contains('h2', 'Atividade recente').should('be.visible')
    cy.contains('a', 'Cálculo I — Prova 1').click()

    cy.contains('h2', 'Versões').should('be.visible')
  })

  it('leva às listas pelos cartões de resumo', () => {
    cy.contains('a', 'Provas').click()

    cy.contains('h1', 'Provas').should('be.visible')
  })
})

/**
 * The greeting and the "Correções pendentes" card. The number comes from the
 * corrections of the teacher signed in, so the tests move it by reading sheets
 * through the app instead of trusting a fixed figure.
 */
describe('painel: saudação e correções pendentes', () => {
  it('saúda a professora pelo primeiro nome', () => {
    cy.visit('/painel')

    cy.contains('Olá, Professora!').should('be.visible')
  })

  it('mostra zero correções pendentes numa conta sem correções', () => {
    cy.visit('/painel')

    cy.contains('a', 'Correções pendentes').should('contain', '0')
  })

  it('conta uma correção que ainda espera nota de discursiva', () => {
    cy.correctFirstSheetOf('Cálculo I — Prova 1')
    cy.get('[aria-label="Navegação principal"]').contains('a', 'Painel').click()

    cy.contains('a', 'Correções pendentes').should('contain', '1')
  })

  it('leva à lista de aplicações já filtrada por correção em andamento', () => {
    cy.correctFirstSheetOf('Cálculo I — Prova 1')
    cy.get('[aria-label="Navegação principal"]').contains('a', 'Painel').click()
    cy.contains('a', 'Correções pendentes').click()

    cy.location().should((location) => expect(location.pathname + location.search).to.match(/^\/aplicacoes\?status=correction-in-progress$/))
    cy.contains('h1', 'Aplicações').should('be.visible')
    cy.contains('label', 'Correção em andamento').find('input[type="radio"]').should('be.checked')
    cy.contains('a', 'Cálculo I — Prova 1').should('be.visible')
    cy.contains('a', 'Física II — Teste rápido').should('not.exist')
  })

  it('não conta as folhas de outra professora', () => {
    cy.correctFirstSheetOf('Cálculo I — Prova 1')
    cy.signInAsNewTeacher()
    cy.visit('/painel')

    cy.contains('a', 'Correções pendentes').should('contain', '0')
  })
})

/**
 * "Corrigir folhas" leads to the upload screen of an application, never to the
 * list of applications. The sample data has one application generated,
 * "Cálculo I — Prova 1", and one still a draft, "Física II — Teste rápido".
 */
describe('painel: corrigir folhas', () => {
  /** RNF06: the main action of a test day, two clicks from the panel. */
  it('leva direto ao envio de folhas da única aplicação gerada', () => {
    cy.visit('/painel')
    cy.contains('a', 'Corrigir folhas').click()

    cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
  })

  it('pede para escolher a aplicação quando há mais de uma gerada', () => {
    cy.generateApplication('Física II — Teste rápido')

    cy.get('[aria-label="Navegação principal"]').contains('a', 'Painel').click()
    cy.contains('button', 'Corrigir folhas').click()

    cy.findInDialog('h2', 'De qual aplicação são as folhas?').should('be.visible')
    cy.findInDialog('a', 'Cálculo I — Prova 1').should('be.visible')
    cy.findInDialog('a', 'Física II — Teste rápido').click()

    cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
    cy.location('pathname').should('match', /^\/aplicacoes\/[^/]+\/corrigir$/)
  })

  /** An empty list of applications would not say what is missing; the panel does. */
  it('explica o que fazer quando nenhuma aplicação foi gerada', () => {
    cy.signInAsNewTeacher({ withSampleData: false })
    cy.visit('/painel')
    cy.contains('button', 'Corrigir folhas').click()

    cy.findInDialog('h2', 'Nenhuma aplicação para corrigir').should('be.visible')
    cy.findInDialog('a', 'Nova aplicação').click()

    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })
})

describe('perfil', () => {
  beforeEach(() => cy.visit('/perfil'))

  it('mostra os dados da conta em leitura', () => {
    cy.contains('h1', 'Meu perfil').should('be.visible')
    cy.contains('h2', 'Dados da conta').should('be.visible')
  })

  /** Each screen's own help button is how a tour comes back, so the profile no longer resets all of them. */
  it('não oferece mais rever o tour de todas as telas', () => {
    cy.contains('h1', 'Meu perfil').should('be.visible')

    cy.contains('button', 'Rever o tour').should('not.exist')
  })

  /** RF04: the session ends here and on every other device. */
  it('sai de todos os dispositivos e volta para o login', () => {
    cy.contains('button', 'Sair de todos os dispositivos').click()

    cy.location('pathname').should('eq', '/entrar')
    cy.visit('/painel')
    cy.location('pathname').should('eq', '/entrar')
  })

  /** Anonymising cannot be undone, so it costs more than one click. */
  it('só libera anonimizar depois de digitar a palavra', () => {
    cy.contains('button', 'Anonimizar minha conta').should('be.disabled')

    cy.findByLabel('Digite ANONIMIZAR para confirmar').type('ANONIMIZAR')

    cy.contains('button', 'Anonimizar minha conta').should('not.be.disabled')
  })

  it('não aceita a palavra escrita de outro jeito', () => {
    cy.findByLabel('Digite ANONIMIZAR para confirmar').type('anonimizar')

    cy.contains('button', 'Anonimizar minha conta').should('be.disabled')
  })
})

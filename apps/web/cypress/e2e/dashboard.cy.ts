import { apiAs, photoOf, printedPaperOf, printForTheTeacher, type SignedInTeacher } from '../support/commands'

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
 * API (#50), counted from the corrections of the teacher signed in, so the
 * tests move it by writing a correction there instead of trusting a fixed
 * figure.
 */
describe('painel: saudação e correções pendentes', () => {
  it('saúda a professora pelo primeiro nome', () => {
    cy.visit('/painel')

    cy.contains('Olá, Professora!').should('be.visible')
  })

  it('mostra zero correções pendentes numa conta sem folhas lidas', () => {
    cy.visit('/painel')

    cy.contains('a', 'Correções pendentes').should('contain', '0')
  })

  it('conta uma correção que ainda não foi finalizada', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [], finalize: false })
    })
    cy.visit('/painel')

    cy.contains('a', 'Correções pendentes').should('contain', '1')
  })

  /** A finished correction of a named sheet owes the teacher nothing. */
  it('não conta a correção finalizada', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet, questionId, correctAlternativeId }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [{ questionId, selectedAlternativeId: correctAlternativeId }], finalize: true })
    })
    cy.visit('/painel')

    cy.contains('a', 'Geometria — Prova da consulta').should('be.visible')
    cy.contains('a', 'Correções pendentes').should('contain', '0')
  })

  it('leva à lista de aplicações já filtrada por correção em andamento', () => {
    cy.correctFirstSheetOf('Cálculo I — Prova 1')
    cy.get('[aria-label="Navegação principal"]').contains('a', 'Painel').click()
    cy.contains('a', 'Correções pendentes').click()

    cy.location().should((location) => expect(location.pathname + location.search).to.match(/^\/aplicacoes\?status=correction-in-progress$/))
    cy.contains('h1', 'Aplicações').should('be.visible')
    cy.contains('label', 'Correção em andamento').find(':checked').should('exist')
    cy.contains('a', 'Cálculo I — Prova 1').should('be.visible')
    cy.contains('a', 'Física II — Teste rápido').should('not.exist')
  })

  it('não conta as folhas de outra professora', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [], finalize: false })
    })
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

/**
 * "Próximo passo" (#202): the one button that moves the teacher's work on. The
 * sample has "Cálculo I — Prova 1" printed for 05/10, never graded, and
 * "Física II — Teste rápido" as a draft for 12/11, so the button depends on the
 * day: the clock is set before each visit, and only `Date` is replaced, so the
 * screens' own timers keep running.
 */
describe('painel: próximo passo', () => {
  /** Noon in Brazil (UTC-3) on 9 November: the draft is three days away, the midterm long sat. */
  const MONDAY = Date.UTC(2026, 10, 9, 15)
  const nextStep = () => cy.contains('h2', 'Próximo passo').parent()

  it('leva às folhas da prova já aplicada, com a outra pendência ao lado', () => {
    cy.clock(MONDAY, ['Date'])
    cy.visit('/painel')

    nextStep().should('contain', 'Cálculo I — Prova 1').and('contain', 'folhas corrigidas')
    nextStep().contains('summary', 'Outras pendências (1)').click()
    nextStep().contains('a', 'Física II — Teste rápido').should('contain', 'Gerar o PDF')
    nextStep().contains('a', 'Corrigir folhas').click()

    cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
  })

  it('na véspera, pede o PDF do rascunho antes das folhas', () => {
    cy.clock(Date.UTC(2026, 10, 11, 15), ['Date'])
    cy.visit('/painel')

    nextStep().contains('a', 'Gerar o PDF').click()

    cy.contains('h1', 'Gerar PDF — Física II — Teste rápido').should('be.visible')
  })

  /**
   * "Terminou?" lands on the grades card of P14 (#notas), with the focus on
   * it. The tour of P14 would take the focus on a first visit, so it is
   * marked as seen.
   */
  it('leva direto às notas da aplicação, para liberar quando a correção acabar', () => {
    cy.clock(MONDAY, ['Date'])
    cy.visitWithoutTours()

    nextStep().contains('a', 'Terminou? Liberar as notas').click()

    cy.contains('h1', 'Cálculo I — Prova 1').should('be.visible')
    cy.focused().should('contain', 'Notas para os alunos')
  })

  /**
   * RNF06 on the phone: the photo leaves from the panel and the reading shows
   * on P15. The printed sitting is of 20/11, so on 21/11 it is the latest
   * sitting to grade.
   */
  it('no celular, fotografa a folha direto do painel e mostra a leitura', () => {
    cy.viewport(360, 740)
    printForTheTeacher().then((printed) => {
      printedPaperOf(printed.accessToken, printed.applicationId).then(({ versions }) => {
        const [version] = versions
        if (version === undefined) throw new Error('A geração não devolveu nenhuma versão.')
        cy.photographSheet(photoOf(printed.sheet, version, { 0: [0] })).then((photo) => {
          cy.clock(Date.UTC(2026, 10, 21, 15), ['Date'])
          cy.visit('/painel')

          nextStep().should('contain', printed.examTitle)
          cy.findByLabel('Fotografar folhas').selectFile(photo, { force: true })

          cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
          cy.contains('Lido · nota prévia', { timeout: 30000 }).should('be.visible')
        })
      })
    })
  })

  it('numa conta nova, cria a turma pelo painel e depois pede os alunos dela', () => {
    cy.signInAsNewTeacher({ withSampleData: false })
    cy.visit('/painel')

    nextStep().contains('button', 'Criar uma turma').click()
    cy.findByLabel('Nome da turma').type('Turma do botão')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2026/2')
    cy.findInDialog('button', 'Salvar').click()
    cy.contains('h1', 'Turma do botão').should('be.visible')

    cy.get('[aria-label="Navegação principal"]').contains('a', 'Painel').click()
    nextStep().should('contain', 'Turma do botão').contains('a', 'Cadastrar os alunos').click()
    cy.contains('h1', 'Turma do botão').should('be.visible')
  })
})

/**
 * Each step of the panel's next step (#202) on an account of its own, built on
 * the API, so the sample does not compete for the button.
 */
describe('painel: próximo passo de cada etapa', () => {
  const nextStep = () => cy.contains('h2', 'Próximo passo').parent()
  const objective = (statement: string) => ({
    type: 'objetiva',
    statement,
    tags: ['Óptica'],
    alternatives: [
      { id: crypto.randomUUID(), text: 'Sim' },
      { id: crypto.randomUUID(), text: 'Não' },
    ],
    allowShuffleAlternatives: false,
  })

  /** A fresh account with one class and one student, and its API. */
  function accountWithAClass(): Cypress.Chainable<{ api: ReturnType<typeof apiAs>; classId: string }> {
    return cy.signInAsNewTeacher({ withSampleData: false }).then(({ accessToken }) => {
      const api = apiAs(accessToken)
      return api<{ id: string }>('POST', '/classes', { name: 'Turma de Óptica', subject: 'Física', term: '2026/2' }).then(({ body }) =>
        api('POST', `/classes/${body.id}/students`, { fullName: 'Lia Prado', registration: '2026777' }).then(() => ({ api, classId: body.id })),
      )
    })
  }

  it('acompanha a montagem: questões, prova e aplicação, uma de cada vez', () => {
    accountWithAClass().then(({ api }) => {
      cy.visit('/painel')
      nextStep().contains('a', 'Escrever questões').should('have.attr', 'href', '/questoes/nova')

      const question = objective('A luz se propaga em linha reta?')
      api<{ id: string }>('POST', '/questions', { ...question, correctAlternativeId: question.alternatives[0]?.id }).then(({ body }) => {
        cy.visit('/painel')
        nextStep().contains('a', 'Montar uma prova').should('have.attr', 'href', '/provas/nova')

        const exam = {
          title: 'Óptica — Prova 1',
          description: '',
          questions: [{ questionId: body.id, order: 0, score: 10, allowShuffleAlternatives: false }],
          defaultShuffleQuestions: false,
          defaultShuffleAlternatives: false,
        }
        api('POST', '/exams', exam).then(() => {
          cy.visit('/painel')
          nextStep().contains('a', 'Aplicar uma prova').click()

          cy.findByLabel('Prova').find(':selected').should('have.text', 'Óptica — Prova 1')
          cy.findByLabel('Turma').find(':selected').should('have.text', 'Turma de Óptica')
        })
      })
    })
  })

  /** The printed sitting is of 20/11: on 15/11 it is still ahead, and the paper is what it needs. */
  it('pede para baixar o PDF de uma prova impressa que ainda não aconteceu', () => {
    cy.signInAsNewTeacher({ withSampleData: false }).then(({ accessToken }) => {
      cy.printApplication(accessToken)
      cy.clock(Date.UTC(2026, 10, 15, 15), ['Date'])
      cy.visit('/painel')

      nextStep().contains('button', 'Baixar o PDF').should('be.visible')
      nextStep().contains('a', 'Já aplicou? Corrigir folhas').should('be.visible')
    })
  })

  it('segue a prova aplicada até o fim: corrigir, publicar o gabarito, liberar as notas e ler o relatório', () => {
    cy.signInAsNewTeacher({ withSampleData: false }).then(({ accessToken }) => {
      cy.printApplication(accessToken).then(({ applicationId, sheet, questionId, correctAlternativeId }) => {
        const api = apiAs(accessToken)
        cy.clock(Date.UTC(2026, 10, 21, 15), ['Date'])
        cy.visitWithoutTours()
        nextStep().contains('a', 'Corrigir folhas').should('be.visible')

        cy.recordCorrection(accessToken, {
          applicationId,
          answerSheetId: sheet.id,
          answers: [{ questionId, selectedAlternativeId: correctAlternativeId }],
          finalize: true,
        })
        cy.visitWithoutTours()
        nextStep().contains('a', 'Publicar o gabarito').click()
        cy.focused().should('contain', 'Versões')

        api('POST', `/applications/${applicationId}/publish-answer-keys`)
        cy.visitWithoutTours()
        nextStep().contains('a', 'Liberar as notas').should('be.visible')

        api('POST', `/applications/${applicationId}/grades-release`, { released: true })
        cy.visitWithoutTours()
        nextStep().contains('a', 'Ver o relatório').click()
        cy.location('pathname').should('eq', `/aplicacoes/${applicationId}/relatorio`)
      })
    })
  })

  /** Every sheet has a correction and one waits for its open-ended score (RF48). */
  it('pede a nota das discursivas quando só elas faltam', () => {
    accountWithAClass().then(({ api, classId }) => {
      const question = objective('A luz é uma onda?')
      const correctAlternativeId = question.alternatives[0]?.id ?? ''
      api<{ id: string }>('POST', '/questions', { ...question, correctAlternativeId }).then(({ body: closed }) =>
        api<{ id: string }>('POST', '/questions', { type: 'discursiva', statement: 'Explique a refração.', tags: ['Óptica'], maxScore: 5, allowShuffleAlternatives: true }).then(({ body: open }) => {
          const exam = {
            title: 'Óptica — Prova 2',
            description: '',
            questions: [
              { questionId: closed.id, order: 0, score: 5, allowShuffleAlternatives: false },
              { questionId: open.id, order: 1, score: 5, allowShuffleAlternatives: false },
            ],
            defaultShuffleQuestions: false,
            defaultShuffleAlternatives: false,
          }
          api<{ id: string }>('POST', '/exams', exam).then(({ body: created }) =>
            api<{ id: string }>('POST', '/applications', { examId: created.id, classId, date: '2026-10-01T12:00:00.000Z' }).then(({ body: application }) =>
              api<{ sheets: { id: string }[] }>('POST', `/applications/${application.id}/generate-pdf`, {
                versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
                withStudentIdentification: true,
              }).then(({ body: printed }) => {
                api('POST', `/applications/${application.id}/corrections`, {
                  answerSheetId: printed.sheets[0]?.id,
                  answers: [{ questionId: closed.id, selectedAlternativeId: correctAlternativeId }],
                  discursiveScores: [],
                  finalize: true,
                })
                cy.visit('/painel')

                nextStep().should('contain', 'Óptica — Prova 2').contains('a', 'Dar nota às discursivas').click()
                cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
              }),
            ),
          )
        }),
      )
    })
  })
})

/** P12 opens with what the teacher came from (#202), so it is not picked twice. */
describe('nova aplicação já escolhida', () => {
  it('abre com a prova de onde a professora veio', () => {
    cy.visit('/provas')
    cy.contains('a', 'Álgebra Linear — Prova 1').click()
    cy.contains('a', 'Nova aplicação com esta prova').click()

    cy.contains('h1', 'Nova aplicação').should('be.visible')
    cy.findByLabel('Prova').find(':selected').should('have.text', 'Álgebra Linear — Prova 1')
    cy.findByLabel('Turma').should('have.value', '')
  })

  /** The sample's linear algebra class has no application yet, which is when P5 offers one. */
  it('abre com a turma de onde a professora veio', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Álgebra Linear').click()
    cy.contains('h1', 'Álgebra Linear').should('be.visible')
    cy.contains('a', 'Nova aplicação').click()

    cy.findByLabel('Turma').find(':selected').should('have.text', 'Álgebra Linear')
  })
})

describe('perfil', () => {
  beforeEach(() => cy.visit('/perfil'))

  /** P2: what the API has for the account (`GET /me`), for reading only. */
  it('mostra nome, e-mail e tipo da conta', () => {
    cy.contains('h1', 'Meu perfil').should('be.visible')
    cy.contains('h2', 'Dados da conta').should('be.visible')
    cy.get<SignedInTeacher>('@teacher').then(({ fullName, email }) => {
      cy.contains('dt', 'Nome').next().should('have.text', fullName)
      cy.contains('dt', 'E-mail').next().should('have.text', email)
    })
    cy.contains('dt', 'Tipo').next().should('have.text', 'Professor')
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

  /** RF05: the account is anonymized on the server, every session ends, and the old e-mail and password no longer sign in. */
  it('anonimiza a conta, volta para o login e não entra mais com ela', () => {
    cy.findByLabel('Digite ANONIMIZAR para confirmar').type('ANONIMIZAR')
    cy.contains('button', 'Anonimizar minha conta').click()

    cy.location('pathname').should('eq', '/entrar')
    cy.get<SignedInTeacher>('@teacher').then(({ email, password }) => {
      cy.request({ method: 'POST', url: '/api/auth/login', body: { email, password }, failOnStatusCode: false }).its('status').should('eq', 401)
    })
  })
})

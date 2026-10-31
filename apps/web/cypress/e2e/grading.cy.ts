import { apiAs, photoOf, printedPaperOf, printForTheTeacher, type PrintedApplication, type SignedInTeacher } from '../support/commands'

/**
 * Correction, P15 to P17 (#47, #48): the photo of a printed sheet goes to the
 * API, which reads its QR Code and marks; the teacher reviews what was read and
 * confirms it, and only then is there a grade.
 *
 * The photos are drawn by the reader's own test kit with the sheet's real QR
 * Code (`cy.photographSheet`), so what the screen shows is the API's reading,
 * not a stubbed answer.
 */
const CALCULUS = 'Cálculo I — Prova 1'

type Printed = PrintedApplication & { accessToken: string }

/** The one sheet `printApplication` prints, photographed with the given marks on its one question. */
function photographPrinted(printed: Printed, marks: Record<number, number[]>): Cypress.Chainable<string> {
  return printedPaperOf(printed.accessToken, printed.applicationId).then(({ versions }) => {
    const [version] = versions
    if (version === undefined) throw new Error('A geração não devolveu nenhuma versão.')
    return cy.photographSheet(photoOf(printed.sheet, version, marks))
  })
}

/** The grade P16 shows while the teacher reviews, next to the "Nota" heading. */
function totalShown(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.contains('h2', 'Nota').next()
}

function openGrading(printed: Printed): void {
  cy.visit(`/aplicacoes/${printed.applicationId}`)
  cy.contains('a', 'Corrigir folhas').click()
  cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
}

/** Prints a sitting, sends the photo of its sheet with the right answer marked, and waits for the reading. */
function sendRightAnswer(): Cypress.Chainable<Printed> {
  return printForTheTeacher().then((printed) => {
    photographPrinted(printed, { 0: [0] }).then((photo) => {
      openGrading(printed)
      cy.sendSheetPhoto(photo)
    })
    cy.contains('Lido · nota prévia 10', { timeout: 30000 }).should('be.visible')
    return cy.wrap(printed)
  })
}

describe('enviar folhas', () => {
  it('lê a foto e mostra a folha, o aluno e a nota prévia', () => {
    sendRightAnswer().then((printed) => {
      cy.contains(`Folha 1 · ${printed.studentName}`).should('be.visible')
    })
  })

  /** A reading is not a grade (RF28): nothing is stored until the teacher confirms the review. */
  it('não grava nota antes da confirmação', () => {
    sendRightAnswer()

    cy.contains('0 de 1 corrigidas').should('be.visible')
    cy.contains('Não corrigida').should('be.visible')
  })

  it('pede a folha quando o QR não é reconhecido, e a falha continua na lista', () => {
    printForTheTeacher().then((printed) => {
      printedPaperOf(printed.accessToken, printed.applicationId).then(({ versions }) => {
        const [version] = versions
        if (version === undefined) throw new Error('A geração não devolveu nenhuma versão.')
        cy.photographSheet({ ...photoOf(printed.sheet, version), qrText: null }).then((photo) => {
          openGrading(printed)
          cy.sendSheetPhoto(photo)
        })
      })

      cy.contains('QR não reconhecido', { timeout: 30000 }).should('be.visible')

      cy.reload()
      cy.contains('h2', 'Fotos que não foram lidas').should('be.visible')
      cy.findByLabel('Qual folha é esta foto?').select(`Folha 1 · ${printed.studentName}`)
      cy.findByLabel('Qual folha é esta foto?').parent().contains('button', 'Revisar').click()

      cy.contains('h1', 'Folha 1').should('be.visible')
      cy.get('[alt="Foto da folha 1"]').should('be.visible')
    })
  })

  it('recusa o que não é foto e diz o motivo', () => {
    printForTheTeacher().then((printed) => {
      openGrading(printed)
      cy.findByLabel('Escolher arquivos').selectFile(
        { contents: Cypress.Buffer.from('não é uma foto'), fileName: 'notas.txt', mimeType: 'text/plain' },
        { force: true },
      )

      cy.contains('[role="alert"]', 'Envie a foto em JPG, PNG ou WebP.', { timeout: 10000 }).should('be.visible')
    })
  })

  /** RF30: a sheet never photographed is graded by typing what is on it. */
  it('lança a correção à mão, sem foto', () => {
    printForTheTeacher().then((printed) => {
      openGrading(printed)
      cy.findByLabel('Escolha a folha').select(`Folha 1 · ${printed.studentName}`)
      cy.findByLabel('Escolha a folha').parent().contains('button', 'Revisar').click()

      cy.contains('h1', 'Folha 1').should('be.visible')
      cy.contains('Correção digitada, sem foto.').should('be.visible')
      cy.get('[aria-label="Questão 1, alternativa A, correta"]').click()
      cy.contains('button', 'Confirmar correção').click()

      cy.contains('h1', 'Enviar folhas de respostas', { timeout: 10000 }).should('be.visible')
      cy.contains('1 de 1 corrigidas').should('be.visible')
      cy.contains('Corrigida · 10').should('be.visible')
    })
  })
})

/** What P15 to P17 show when there is nothing to grade, when the server fails, and to another teacher (#67). */
describe('correção: vazio, erro e isolamento', () => {
  it('explica que não há folhas antes de gerar o PDF', () => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Física II — Teste rápido').click()
    cy.contains('h1', 'Física II — Teste rápido').should('be.visible')
    cy.location('pathname').then((detail) => cy.visit(`${detail}/corrigir`))

    cy.contains('Esta aplicação ainda não foi gerada, então não há folhas para corrigir.').should('be.visible')
    cy.contains('label', 'Escolher arquivos').should('not.exist')
  })

  it('diz que não carregou quando o servidor falha', () => {
    printForTheTeacher().then((printed) => {
      cy.intercept({ method: 'GET', pathname: `/api/applications/${printed.applicationId}/sheets` }, { statusCode: 500, body: { code: 'FAILURE', message: 'Erro inesperado.' } })
      cy.visit(`/aplicacoes/${printed.applicationId}/corrigir`)
    })

    cy.contains('[role="alert"]', 'Não foi possível carregar os dados', { timeout: 20000 }).should('be.visible')
  })

  /** The API answers 404 for another teacher's application, so neither the sheets nor the review open. */
  it('não abre as folhas nem a revisão de outra professora', () => {
    printForTheTeacher().then((printed) => {
      cy.clearCookies()
      cy.signInAsNewTeacher({ withSampleData: false })
      cy.visit(`/aplicacoes/${printed.applicationId}/corrigir/${printed.sheet.id}`)
    })

    cy.contains(/Folha não encontrada\.|Não foi possível carregar os dados/, { timeout: 20000 }).should('be.visible')
    cy.contains('button', 'Confirmar correção').should('not.exist')
  })

  /**
   * RF31: two sheets printed without names cannot both be the same student on
   * one version. The first is assigned through the API; giving the second the
   * same student on P16 shows the API's refusal on the screen.
   */
  it('recusa associar o mesmo aluno a duas folhas da mesma versão', () => {
    printForTheTeacher({ withStudentIdentification: false }).then((printed) => {
      const api = apiAs(printed.accessToken)
      api<{ classId: string }>('GET', `/applications/${printed.applicationId}`).then(({ body: { classId } }) => {
        api<{ items: { id: string }[] }>('GET', `/classes/${classId}/students`).then(({ body: students }) => {
          const studentId = students.items[0]?.id ?? ''
          api<{ id: string }>('POST', `/classes/${classId}/students`, { fullName: 'Tiago Moreira', registration: '2026902' })
          api('POST', `/applications/${printed.applicationId}/generate-pdf`, {
            versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
            withStudentIdentification: false,
          })
          printedPaperOf(printed.accessToken, printed.applicationId).then(({ sheets }) => {
            const [first, second] = sheets.toSorted((a, b) => a.sheetNumber - b.sheetNumber)
            cy.recordCorrection(printed.accessToken, { applicationId: printed.applicationId, answerSheetId: first?.id ?? '', answers: [], finalize: false }).then(
              (correction) => api('PATCH', `/applications/${printed.applicationId}/corrections/${correction.id}`, { studentId }),
            )
            cy.recordCorrection(printed.accessToken, { applicationId: printed.applicationId, answerSheetId: second?.id ?? '', answers: [], finalize: false })
            cy.visit(`/aplicacoes/${printed.applicationId}/pendentes`)
            cy.get(`[aria-label="Associar aluno à folha ${second?.sheetNumber ?? ''}"]`).click()
          })
        })
      })

      cy.get('[aria-label="Associar esta folha a um aluno"]').select(printed.studentName)
      cy.contains('[role="alert"]', 'Já existe uma correção deste aluno nesta versão').should('be.visible')
    })
  })
})

describe('revisar e confirmar', () => {
  beforeEach(() => {
    sendRightAnswer()
    cy.get('[aria-label="Revisar a folha 1"]').click()
    cy.contains('h1', 'Folha 1').should('be.visible')
  })

  it('mostra a foto ao lado do que foi lido', () => {
    cy.get('[alt="Foto da folha 1"]').should('be.visible')
    cy.get('[aria-label="Questão 1, alternativa A, correta"]').should('have.attr', 'aria-pressed', 'true')
    totalShown().should('have.text', '10')
  })

  it('confirma, e a correção entra na lista com a nota', () => {
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('h1', 'Enviar folhas de respostas', { timeout: 10000 }).should('be.visible')
    cy.contains('1 de 1 corrigidas').should('be.visible')
    cy.contains('Corrigida · 10').should('be.visible')
  })

  it('corrige a marcação lida, recalcula a nota e guarda a mudança', () => {
    cy.get('[aria-label="Questão 1, alternativa B"]').click()
    totalShown().should('have.text', '0')
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('Corrigida · 0', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label^="Revisar a folha 1, "]').click()
    cy.get('[aria-label="Questão 1, alternativa B"]').should('have.attr', 'aria-pressed', 'true')
  })

  it('salva sem finalizar e a correção fica em andamento', () => {
    cy.contains('button', 'Salvar sem finalizar').click()

    cy.contains('Em andamento · 10', { timeout: 10000 }).should('be.visible')
  })

  it('permite girar e ampliar a foto', () => {
    cy.get('[aria-label="Girar a foto"]').click()
    cy.get('[aria-label="Aumentar o zoom"]').click()

    cy.get('[alt="Foto da folha 1"]').should('have.attr', 'style').and('contain', 'rotate: 90deg')
  })
})

/**
 * A mixed exam (the sample calculus midterm): the photo grades the
 * multiple-choice questions and the open-ended one waits for the teacher,
 * starting at zero (RF47, RF48).
 */
describe('discursivas', () => {
  beforeEach(() => {
    cy.visit('/aplicacoes')
    cy.contains('a', CALCULUS).click()
    cy.contains('h1', CALCULUS).should('be.visible')
    cy.location('pathname').then((pathname) => {
      const applicationId = pathname.split('/').pop() ?? ''
      cy.get<SignedInTeacher>('@teacher').then(({ accessToken }) =>
        printedPaperOf(accessToken, applicationId).then(({ sheets, versions }) => {
          const sheet = sheets.find((item) => item.sheetNumber === 1)
          const version = versions.find((item) => item.id === sheet?.examVersionId)
          if (sheet === undefined || version === undefined) throw new Error('A prova de exemplo não tem a folha 1.')
          cy.photographSheet(photoOf(sheet, version)).as('photo')
        }),
      )
    })
    cy.contains('a', 'Corrigir folhas').click()
    cy.get<string>('@photo').then((photo) => cy.sendSheetPhoto(photo))
    cy.contains('Em andamento', { timeout: 30000 }).should('be.visible')
    cy.get('[aria-label="Revisar a folha 1"]').click()
  })

  it('avisa que a discursiva começa valendo 0 e finaliza ao confirmar', () => {
    cy.get('[role="status"]').should('contain', 'A questão discursiva começa valendo 0')
    cy.contains('Valendo 0').should('be.visible')
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('1 de 12 corrigidas', { timeout: 10000 }).should('be.visible')
    cy.contains('Corrigida · 0').should('be.visible')
  })

  it('soma a nota da discursiva e a guarda ao salvar sem finalizar', () => {
    cy.get('[aria-label^="Nota da questão"]').clear().type('2.5')
    totalShown().should('have.text', '2.5')
    cy.contains('button', 'Salvar sem finalizar').click()

    cy.contains('Em andamento · 2.5', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label^="Revisar a folha 1, "]').click()
    cy.get('[aria-label^="Nota da questão"]').should('have.value', '2.5')
  })
})

/** RF31: a sheet printed without the student's name waits on P17 until somebody says whose it is. */
describe('pendentes de atribuição', () => {
  it('lista a folha sem dono e a tira da lista depois de associar o aluno', () => {
    printForTheTeacher({ withStudentIdentification: false }).then((printed) => {
      photographPrinted(printed, { 0: [0] }).then((photo) => {
        openGrading(printed)
        cy.sendSheetPhoto(photo)
      })
      cy.get('[aria-label="Revisar a folha 1"]', { timeout: 30000 }).click()
      cy.contains('h2', 'De quem é esta folha?').should('be.visible')
      cy.contains('button', 'Confirmar correção').click()

      cy.contains('a', 'Ver correções pendentes de atribuição', { timeout: 10000 }).click()
      cy.contains('h1', 'Pendentes de atribuição').should('be.visible')
      cy.get('[aria-label="Associar aluno à folha 1"]').click()
      cy.get('[aria-label="Associar esta folha a um aluno"]').select(printed.studentName)
      cy.contains('button', 'Confirmar correção').click()

      cy.contains('a', 'Ver correções pendentes de atribuição', { timeout: 10000 }).click()
      cy.contains('Nenhuma pendência').should('be.visible')
    })
  })
})

describe('relatório da aplicação', () => {
  const reportOf = (applicationId: string) => `/aplicacoes/${applicationId}/relatorio`

  /** The way a teacher gets there: the review confirmed through the screens, then "Ver relatório" on P14. */
  it('mostra a correção confirmada pela tela no relatório, aberto pela aplicação', () => {
    sendRightAnswer().then((printed) => {
      cy.get('[aria-label="Revisar a folha 1"]').click()
      cy.contains('button', 'Confirmar correção').click()
      cy.contains('Corrigida · 10', { timeout: 10000 }).should('be.visible')

      cy.contains('a', 'Aplicação').click()
      cy.contains('a', 'Ver relatório').click()

      cy.contains('h1', 'Relatório da aplicação').should('be.visible')
      cy.contains('Média').should('be.visible')
      cy.contains('tr', printed.studentName).should('contain', '10')
    })
  })

  it('explica que nada foi corrigido ainda', () => {
    printForTheTeacher().then(({ applicationId }) => cy.visit(reportOf(applicationId)))

    cy.contains('h3', 'Nada corrigido ainda').should('be.visible')
    cy.contains('0 de 1 folhas corrigidas').should('be.visible')
  })

  it('calcula as estatísticas depois da primeira correção', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet, questionId, correctAlternativeId }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [{ questionId, selectedAlternativeId: correctAlternativeId }], finalize: true })
      cy.visit(reportOf(applicationId))
    })

    cy.contains('h1', 'Relatório da aplicação').should('be.visible')
    cy.contains('1 de 1 folhas corrigidas').should('be.visible')
    cy.contains('Média').should('be.visible')
    cy.contains('h2', 'Distribuição das notas').should('be.visible')
    cy.contains('tr', 'Rafaela Souza').should('contain', '2026901').and('contain', '10')
    cy.contains('h2', 'Por questão').should('be.visible')
    cy.contains('100% de acerto').should('be.visible')
    cy.contains('h2', 'Por conteúdo').should('be.visible')
    cy.contains('li', 'Geometria').should('contain', '100%')
  })

  /** RF48: the grade counts once the correction is finished; until then it is named apart, out of every number. */
  it('conta à parte a correção em andamento, fora das estatísticas', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [], finalize: false })
      cy.visit(reportOf(applicationId))
    })

    cy.contains('1 em andamento').should('be.visible')
    cy.contains('h3', 'Nada corrigido ainda').should('be.visible')
  })

  /** RF36 and RF41: the notice confirms at once, and the file is downloaded from it, one row per student. */
  it('exporta o relatório em CSV e baixa o arquivo pelo aviso', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet, questionId, correctAlternativeId }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [{ questionId, selectedAlternativeId: correctAlternativeId }], finalize: true })
      cy.visit(reportOf(applicationId))
    })
    cy.intercept({ method: 'GET', pathname: /^\/api\/applications\/[^/]+\/report$/, query: { format: 'csv' } }).as('export')

    cy.contains('button', 'Exportar CSV').click()

    cy.contains('[aria-label="Operações em segundo plano"]', 'Relatório da aplicação em CSV').should('be.visible')
    cy.wait('@export').its('response.headers.content-type').should('contain', 'text/csv')
    cy.contains('button', 'Baixar relatorio-aplicacao-2026-11-20.csv').click()
    cy.readFile(`${Cypress.config('downloadsFolder')}/relatorio-aplicacao-2026-11-20.csv`)
      .should('contain', 'Aluno;Matrícula;Versão;Q1;Total')
      .and('contain', 'Rafaela Souza;2026901;1;10;10')
  })

  /** RF41: the teacher leaves the report while the file is made and finds it ready on the next screen. */
  it('avisa que o arquivo ficou pronto mesmo fora da tela do relatório', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet, questionId, correctAlternativeId }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [{ questionId, selectedAlternativeId: correctAlternativeId }], finalize: true })
      cy.visit(reportOf(applicationId))
    })

    cy.contains('button', 'Exportar PDF').click()
    cy.get('[aria-label="Navegação principal"]').contains('a', 'Painel').click()

    cy.contains('h1', 'Painel').should('be.visible')
    cy.contains('[role="status"]', 'Relatório da aplicação em PDF: pronto.').should('be.visible')
    cy.contains('button', 'Baixar relatorio-aplicacao-2026-11-20.pdf').should('be.visible')
    cy.get('[aria-label="Fechar aviso"]').click()
    cy.contains('Relatório da aplicação em PDF').should('not.exist')
  })

  it('não oferece exportar antes da primeira correção', () => {
    printForTheTeacher().then(({ applicationId }) => cy.visit(reportOf(applicationId)))

    cy.contains('h3', 'Nada corrigido ainda').should('be.visible')
    cy.contains('button', 'Exportar Excel').should('be.disabled')
    cy.contains('button', 'Exportar CSV').should('be.disabled')
    cy.contains('button', 'Exportar PDF').should('be.disabled')
  })

  /** The API answers 404 for another teacher's application, so the screen has nothing of hers to draw. */
  it('não abre o relatório de outra professora', () => {
    printForTheTeacher().then(({ applicationId }) => {
      cy.signInAsNewTeacher({ withSampleData: false })
      cy.visit(reportOf(applicationId))
    })

    cy.get('[role="alert"]').should('contain', 'Não foi possível carregar os dados')
    cy.contains('Geometria — Prova da consulta').should('not.exist')
  })
})

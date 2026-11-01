import type { GenerationRequest } from '@/lib/schemas'
import type { AnswerSheet } from '@/types/domain'
import { apiAs, printForTheTeacher } from '../support/commands'

/**
 * The only screen without a login, and it shows a name beside a grade.
 *
 * Everything here is about showing the least the rule allows: an unknown code
 * says so without hinting at anything, and the two levels of release nest.
 * The page reads `GET /public/sheets/:code`, limited to 30 requests a minute
 * per address, so the spec keeps its own lookups few and stubs the one that
 * has to hit the limit.
 */
describe('consulta pública', () => {
  it('diz que o QR é inválido, sem erro técnico', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')

    cy.contains('h1', 'QR inválido').should('be.visible')
    cy.contains('Erro').should('not.exist')
  })

  it('oferece o aviso de privacidade a quem chegou pelo QR', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')

    cy.contains('a', 'Aviso de privacidade').click()

    cy.contains('h1', 'Aviso de privacidade').should('be.visible')
  })

  it('dá 44 px de altura ao link do aviso de privacidade e ao de voltar', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')
    cy.contains('a', 'Aviso de privacidade').invoke('outerHeight').should('be.gte', 44)

    cy.visit('/privacidade')
    cy.contains('a', 'Voltar para o início').invoke('outerHeight').should('be.gte', 44)
  })

  it('pede aos buscadores que não indexem a página', () => {
    cy.visit('/r/CODIGOQUENAOEXISTE')

    cy.get('head meta[name="robots"]').should('have.attr', 'content').and('contain', 'noindex')
  })

  /**
   * Reaching the real limit would take 31 lookups and block every other one
   * from this address for a minute, so the API's answer is stubbed; the API
   * tests prove the limit itself. Asking to read the code again later, and
   * not to reload, is the point: a reload spends more of the same budget.
   */
  it('pede para esperar, sem erro genérico, quando as consultas passam do limite', () => {
    cy.intercept('GET', '/api/public/sheets/*', {
      statusCode: 429,
      body: { code: 'too-many-requests', message: 'Muitas requisições em pouco tempo. Tente de novo em instantes.' },
    })

    cy.visit('/r/CODIGOQUALQUER')

    cy.contains('[role="alert"]', 'Muitas consultas seguidas. Aguarde um minuto e leia o QR de novo.').should('be.visible')
    cy.contains('h1', 'QR inválido').should('not.exist')
  })
})

/** Opens the page the QR code of a sheet leads to. */
function scan(code: string): void {
  cy.visit(`/r/${code}`)
}

/** The detail of the application this test printed, reached through the list as the teacher would. */
function openDetailOf(title: string): void {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('h1', title).should('be.visible')
  cy.contains('h2', 'Versões').should('be.visible')
}

/** The same paper `printApplication` asks for: one version, so one sheet per student. */
const ONE_VERSION: GenerationRequest = {
  versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
  withStudentIdentification: true,
}

/**
 * Every lookup here reads a sheet the test printed on the API a moment
 * before, with its code taken from the answer of the generation. Each step
 * the teacher takes on screen is confirmed by the screen before the page is
 * visited, since a visit while the write is still in flight would throw it
 * away.
 */
describe('consulta pública de uma folha impressa', () => {
  it('mostra o gabarito e depois a nota conforme o professor libera, e vira QR inválido ao arquivar', () => {
    printForTheTeacher().then(({ accessToken, applicationId, examTitle, studentName, sheet, questionId, correctAlternativeId }) => {
      scan(sheet.code)
      cy.contains('h1', examTitle).should('be.visible')
      cy.contains(studentName).should('be.visible')
      cy.contains('h2', 'Ainda não liberado').should('be.visible')
      cy.contains('h2', 'Gabarito').should('not.exist')

      openDetailOf(examTitle)
      cy.contains('button', 'Publicar todos').click()
      cy.findInDialog('button', 'Publicar todos').click()
      cy.contains('li', 'Versão 1').should('contain', 'Gabarito publicado')

      scan(sheet.code)
      cy.contains('h2', 'Gabarito').should('be.visible')
      cy.contains('A nota ainda não foi liberada').should('be.visible')
      cy.contains('h2', 'Sua nota').should('not.exist')

      cy.recordCorrection(accessToken, {
        applicationId,
        answerSheetId: sheet.id,
        answers: [{ questionId, selectedAlternativeId: correctAlternativeId }],
        finalize: true,
      })
      openDetailOf(examTitle)
      cy.contains('button', 'Liberar notas').click()
      cy.findInDialog('button', 'Liberar notas').click()
      cy.contains('button', 'Recolher notas').should('be.visible')

      scan(sheet.code)
      cy.contains('h2', 'Sua nota').parent().should('contain', '10')
      cy.contains('Você acertou').should('be.visible')

      openDetailOf(examTitle)
      cy.contains('button', 'Ações').click()
      cy.contains('[role="menuitem"]', 'Arquivar').click()
      cy.findInDialog('button', 'Arquivar').click()
      cy.contains('Esta aplicação está arquivada').should('be.visible')

      scan(sheet.code)
      cy.contains('h1', 'QR inválido').should('be.visible')
      cy.contains(examTitle).should('not.exist')
      cy.contains(studentName).should('not.exist')
    })
  })

  /**
   * A correction left open still waits for the teacher, so its total is not
   * final: with the key published and the grades released, the student sees
   * the key and no grade until the teacher confirms.
   */
  it('não mostra nota enquanto a correção está em andamento, mesmo com as notas liberadas', () => {
    printForTheTeacher().then(({ accessToken, applicationId, sheet, questionId, correctAlternativeId }) => {
      const api = apiAs(accessToken)
      api('POST', `/applications/${applicationId}/publish-answer-keys`)
      cy.recordCorrection(accessToken, {
        applicationId,
        answerSheetId: sheet.id,
        answers: [{ questionId, selectedAlternativeId: correctAlternativeId }],
        finalize: false,
      })
      api('POST', `/applications/${applicationId}/grades-release`, { released: true })

      scan(sheet.code)
      cy.contains('h2', 'Gabarito').should('be.visible')
      cy.contains('h2', 'Sua nota').should('not.exist')
      cy.contains('Você acertou').should('not.exist')
    })
  })

  /** RF24: printing again replaces every sheet, and the code on the old paper leads nowhere. */
  it('recusa o código da folha antiga depois de gerar o PDF de novo, e aceita o novo', () => {
    printForTheTeacher().then(({ accessToken, applicationId, examTitle, sheet }) => {
      apiAs(accessToken)<{ sheets: AnswerSheet[] }>('POST', `/applications/${applicationId}/generate-pdf`, ONE_VERSION).then(({ body }) => {
        const reprinted = body.sheets.find((item) => item.sheetNumber === sheet.sheetNumber)
        if (reprinted === undefined) throw new Error('A folha não voltou na nova geração.')
        expect(reprinted.code, 'código novo').not.to.equal(sheet.code)

        scan(sheet.code)
        cy.contains('h1', 'QR inválido').should('be.visible')

        scan(reprinted.code)
        cy.contains('h1', examTitle).should('be.visible')
        cy.contains('h2', 'Ainda não liberado').should('be.visible')
      })
    })
  })

  /** Without identification the sheet says nothing about who holds it: its number and version only. */
  it('mostra o número da folha, e não o nome, quando a aplicação não imprime o aluno', () => {
    printForTheTeacher({ withStudentIdentification: false }).then(({ examTitle, studentName, sheet }) => {
      scan(sheet.code)

      cy.contains('h1', examTitle).should('be.visible')
      cy.contains(`Folha ${sheet.sheetNumber} · versão 1`).should('be.visible')
      cy.contains(studentName).should('not.exist')
    })
  })
})

describe('aviso de privacidade', () => {
  beforeEach(() => cy.visit('/privacidade'))

  it('diz quais dados são tratados e para quê', () => {
    cy.contains('h2', 'Quais dados são tratados').should('be.visible')
    cy.contains('h2', 'Para quê').should('be.visible')
  })

  it('nomeia controlador e operador', () => {
    cy.contains('h2', 'Quem responde').should('be.visible')
    cy.contains('operador').should('be.visible')
  })

  it('explica os direitos e como exercê-los', () => {
    cy.contains('h2', 'Seus direitos').should('be.visible')
    cy.contains('h2', 'Contato').should('be.visible')
  })
})

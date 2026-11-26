import type { ApplicationOverview } from '@/types/domain'
import { apiAs, printForTheTeacher } from '../support/commands'

/**
 * The e-mail that gives each student the link to their own grade page: an
 * opt-in step on the detail of an application, offered only once the grades
 * are released. The API in the pipeline has no mail account, so its log mailer
 * takes the messages and the counts are what the screen reports.
 */
const STUDENT_WITHOUT_SHEET = { fullName: 'Tiago Nunes', registration: '2026902' }

/**
 * Prints one sitting whose only student has an e-mail, publishes its answer
 * keys on the API, adds a student who joined after the printing (no sheet), and
 * opens the detail.
 */
function openPrintedApplication() {
  printForTheTeacher().then(({ accessToken, applicationId, sheet }) => {
    const api = apiAs(accessToken)
    api<ApplicationOverview>('GET', `/applications/${applicationId}`).then(({ body: { classId } }) => {
      api('PATCH', `/classes/${classId}/students/${String(sheet.studentId)}`, { email: 'rafaela@exemplo.edu.br' })
      api('POST', `/classes/${classId}/students`, STUDENT_WITHOUT_SHEET)
    })
    api('POST', `/applications/${applicationId}/publish-answer-keys`)
    cy.visit(`/aplicacoes/${applicationId}`)
  })
}

describe('link da nota por e-mail', () => {
  beforeEach(openPrintedApplication)

  it('só oferece o envio depois de liberar as notas', () => {
    cy.contains('h2', 'Notas para os alunos').should('be.visible')
    cy.contains('button', 'Enviar link por e-mail').should('not.exist')

    cy.contains('button', 'Liberar notas').click()
    cy.findInDialog('button', 'Liberar notas').click()
    cy.contains('button', 'Enviar link por e-mail').should('be.enabled')

    cy.contains('button', 'Recolher notas').click()
    cy.contains('button', 'Enviar link por e-mail').should('not.exist')
  })

  it('pede confirmação e não envia nada ao cancelar', () => {
    cy.contains('button', 'Liberar notas').click()
    cy.findInDialog('button', 'Liberar notas').click()

    cy.contains('button', 'Enviar link por e-mail').click()
    cy.findInDialog('h2', 'Enviar o link por e-mail?').should('be.visible')
    cy.get('[role="dialog"]').should('contain', 'A mensagem não traz a nota')
    cy.findInDialog('button', 'Cancelar').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('enviado').should('not.exist')
  })

  it('conta quantos e-mails saíram e quem ficou de fora', () => {
    cy.contains('button', 'Liberar notas').click()
    cy.findInDialog('button', 'Liberar notas').click()

    cy.contains('button', 'Enviar link por e-mail').click()
    cy.findInDialog('button', 'Enviar e-mails').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('[role="status"]', '1 e-mail enviado.').should('contain', 'sem folha: 1')
  })
})

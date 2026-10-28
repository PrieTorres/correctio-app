import { sampleClasses, sampleExams, sampleQuestions, writeDemoData, type RemoteRoster } from '@/lib/seed'
import type { AuthenticatedUser, Class, Student } from '@/types/domain'

/** The password of every teacher the suite signs up; long enough for the 8-character rule. */
export const TEST_PASSWORD = 'senha-de-teste-1'

/** An address no earlier run used: the API keeps every account, and the same address twice is refused. */
export function uniqueEmail(prefix = 'prof'): string {
  return `${prefix}-${Date.now()}-${Cypress._.random(1e6)}@exemplo.edu.br`
}

/** What the API answers on sign-up: the access token lets the suite create the sample as this teacher. */
interface NewSession {
  user: AuthenticatedUser
  accessToken: string
}

/** A request to the API as the teacher just signed up. */
function apiAs(accessToken: string) {
  return <T>(method: Cypress.HttpMethod, path: string, body?: Cypress.RequestBody) =>
    cy.request<T>({ method, url: `/api${path}`, body, auth: { bearer: accessToken } })
}

/**
 * Creates the sample classes and their students on the API, as the teacher
 * just signed up, and answers which id each sample class got there.
 *
 * The class and student screens read the API, so a sample written only to
 * `localStorage` would be invisible to them, and the sample applications and
 * sheets would point at classes that do not exist. Each test signs up its own
 * teacher, so the import limit of the API, counted per teacher, is never near.
 */
function createSampleClasses(accessToken: string): Cypress.Chainable<Pick<RemoteRoster, 'classIds' | 'students'>> {
  const classIds: Record<string, string> = {}
  const students: Student[] = []
  const api = apiAs(accessToken)

  for (const sample of sampleClasses()) {
    api<Class>('POST', '/classes', sample.input).then(({ body: created }) => {
      classIds[sample.sampleId] = created.id
      if (sample.archived) api('PATCH', `/classes/${created.id}/archive`)
      if (sample.students.length === 0) return

      api('POST', `/classes/${created.id}/students/import`, { rows: sample.students })
      api<{ items: Student[] }>('GET', `/classes/${created.id}/students?pageSize=1000`).then(({ body: page }) => {
        students.push(...page.items)
      })
    })
  }

  return cy.wrap(null, { log: false }).then(() => ({ classIds, students }))
}

/**
 * Creates the sample questions on the API and answers which id each got
 * there. The question bank reads the API since #44, so the sample exams and
 * the versions printed from them have to point at those ids; the
 * alternatives keep their sample ids, which the API stores as sent.
 */
function createSampleQuestions(accessToken: string): Cypress.Chainable<Record<string, string>> {
  const questionIds: Record<string, string> = {}
  const api = apiAs(accessToken)

  for (const sample of sampleQuestions()) {
    api<{ id: string }>('POST', '/questions', sample.input).then(({ body: created }) => {
      questionIds[sample.sampleId] = created.id
    })
  }

  return cy.wrap(null, { log: false }).then(() => questionIds)
}

/**
 * Creates the sample exams on the API, pointing at the questions created
 * there, and answers which id each got. The API creates every exam as a draft,
 * so the sample that is already applied is marked ready, and the archived one
 * archived, through their own routes.
 */
function createSampleExams(accessToken: string, questionIds: Readonly<Record<string, string>>): Cypress.Chainable<Record<string, string>> {
  const examIds: Record<string, string> = {}
  const api = apiAs(accessToken)

  for (const sample of sampleExams(questionIds)) {
    api<{ id: string }>('POST', '/exams', sample.input).then(({ body: created }) => {
      examIds[sample.sampleId] = created.id
      if (sample.status === 'ready') api('PATCH', `/exams/${created.id}/ready`)
      if (sample.status === 'closed') api('PATCH', `/exams/${created.id}/archive`)
    })
  }

  return cy.wrap(null, { log: false }).then(() => examIds)
}

/**
 * Signs a new teacher up on the API and leaves the browser signed in, the way
 * the app itself would: `cy.request` keeps the refresh cookie the API sets, and
 * the app restores the session from it on the next visit.
 *
 * The sample data is created for this teacher, so every spec starts from the
 * same populated screens the demo shows, owned by a real account: the classes,
 * students, questions and exams on the API, and the rest in `localStorage`,
 * pointing at them.
 */
Cypress.Commands.add('signInAsNewTeacher', ({ withSampleData = true }: { withSampleData?: boolean } = {}) => {
  const account = { fullName: 'Professora Ana Ribeiro', email: uniqueEmail(), password: TEST_PASSWORD }
  return cy.request<NewSession>('POST', '/api/auth/register', account).then(({ body }) => {
    const teacher = { ...body.user, password: TEST_PASSWORD }
    if (!withSampleData) return cy.wrap(teacher, { log: false })

    return createSampleClasses(body.accessToken).then((roster) =>
      createSampleQuestions(body.accessToken).then((questionIds) =>
        createSampleExams(body.accessToken, questionIds).then((examIds) => {
          writeDemoData(body.user.id, { ...roster, questionIds, examIds })
          return teacher
        }),
      ),
    )
  })
})

/**
 * Finds a form control by its visible label.
 *
 * Selecting by what the user sees keeps the tests off markup details, and fails
 * loudly when a field loses the label that names it for a screen reader.
 *
 * `cy.contains` retries, which matters: reading the DOM once through
 * `cy.get('body').then(...)` does not, so on a screen still resolving its query
 * the form is simply not there yet and the command misses it.
 */
Cypress.Commands.add('findByLabel', (text: string) => {
  return cy.contains('label', text).then(($label) => {
    const id = $label.attr('for')
    if (id === undefined) throw new Error(`O label "${text}" não aponta para nenhum campo.`)
    return cy.get(`#${CSS.escape(id)}`)
  })
})

/**
 * Scopes a query to the open dialog.
 *
 * A confirmation dialog usually repeats the label of the button that opened
 * it, and the original stays in the DOM behind the overlay. Without scoping,
 * the test picks the one the modal has made inert.
 */
Cypress.Commands.add('findInDialog', (selector: string, text: string) => {
  return cy.get('[role="dialog"]').should('be.visible').contains(selector, text)
})

/**
 * Picks one option of a segmented control by its visible text.
 *
 * The control hides the radio with `sr-only` so the label can carry the
 * styling, which leaves the input with no size and covered by the fieldset:
 * `cy.check()` refuses it, and rightly so. Clicking the label is what a person
 * does, and the browser forwards it to the input.
 *
 * The assertion that follows is the point — it fails loudly if the label ever
 * stops being wired to its input, which no click alone would reveal.
 */
Cypress.Commands.add('chooseSegment', (text: string) => {
  cy.contains('label', text).click()
  return cy.contains('label', text).find('input[type="radio"]').should('be.checked')
})

declare global {
  namespace Cypress {
    interface Chainable {
      findByLabel(text: string): Chainable<JQuery<HTMLElement>>
      findInDialog(selector: string, text: string): Chainable<JQuery<HTMLElement>>
      chooseSegment(text: string): Chainable<JQuery<HTMLElement>>
      signInAsNewTeacher(options?: { withSampleData?: boolean }): Chainable<AuthenticatedUser & { password: string }>
    }
  }
}

export {}

import { sampleApplications, sampleClasses, sampleExams, sampleQuestions } from '@/lib/seed'
import type { AuthenticatedUser, Class } from '@/types/domain'

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
 * Each test signs up its own teacher, so the import limit of the API, counted
 * per teacher, is never near.
 */
function createSampleClasses(accessToken: string): Cypress.Chainable<Record<string, string>> {
  const classIds: Record<string, string> = {}
  const api = apiAs(accessToken)

  for (const sample of sampleClasses()) {
    api<Class>('POST', '/classes', sample.input).then(({ body: created }) => {
      classIds[sample.sampleId] = created.id
      if (sample.archived) api('PATCH', `/classes/${created.id}/archive`)
      if (sample.students.length > 0) api('POST', `/classes/${created.id}/students/import`, { rows: sample.students })
    })
  }

  return cy.wrap(null, { log: false }).then(() => classIds)
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
 * so the archived one is archived through its route; the one already applied
 * becomes ready when its application is generated (`createSampleApplications`).
 */
function createSampleExams(accessToken: string, questionIds: Readonly<Record<string, string>>): Cypress.Chainable<Record<string, string>> {
  const examIds: Record<string, string> = {}
  const api = apiAs(accessToken)

  for (const sample of sampleExams(questionIds)) {
    api<{ id: string }>('POST', '/exams', sample.input).then(({ body: created }) => {
      examIds[sample.sampleId] = created.id
      if (sample.status === 'closed') api('PATCH', `/exams/${created.id}/archive`)
    })
  }

  return cy.wrap(null, { log: false }).then(() => examIds)
}

/**
 * Creates the sample applications on the API, and generates the one the demo
 * shows printed, so its versions, sheets and PDF come from the server, as any
 * teacher's do. Generating is also what marks its exam ready.
 */
function createSampleApplications(
  accessToken: string,
  classIds: Readonly<Record<string, string>>,
  examIds: Readonly<Record<string, string>>,
): Cypress.Chainable<null> {
  const api = apiAs(accessToken)

  for (const sample of sampleApplications(classIds, examIds)) {
    api<{ id: string }>('POST', '/applications', sample.input).then(({ body: created }) => {
      if (sample.generation !== undefined) api('POST', `/applications/${created.id}/generate-pdf`, sample.generation)
    })
  }

  return cy.wrap(null, { log: false })
}

/**
 * Signs a new teacher up on the API and leaves the browser signed in, the way
 * the app itself would: `cy.request` keeps the refresh cookie the API sets, and
 * the app restores the session from it on the next visit.
 *
 * The sample data is created on the API for this teacher, so every spec starts
 * from the same populated screens the demo shows, owned by a real account:
 * classes, students, questions, exams and applications, one of them already
 * generated.
 */
Cypress.Commands.add('signInAsNewTeacher', ({ withSampleData = true }: { withSampleData?: boolean } = {}) => {
  const account = { fullName: 'Professora Ana Ribeiro', email: uniqueEmail(), password: TEST_PASSWORD }
  return cy.request<NewSession>('POST', '/api/auth/register', account).then(({ body }) => {
    const teacher = { ...body.user, password: TEST_PASSWORD }
    if (!withSampleData) return cy.wrap(teacher, { log: false })

    return createSampleClasses(body.accessToken).then((classIds) =>
      createSampleQuestions(body.accessToken).then((questionIds) =>
        createSampleExams(body.accessToken, questionIds).then((examIds) =>
          createSampleApplications(body.accessToken, classIds, examIds).then(() => teacher),
        ),
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

/**
 * Prints the versions and sheets of a draft application, through its own
 * screens. Ends on the application page, which proves the write landed.
 */
Cypress.Commands.add('generateApplication', (title: string) => {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('a', 'Gerar').click()
  cy.contains('button', 'Gerar').click()
  cy.contains('h1', title, { timeout: 20000 }).should('be.visible')
})

/**
 * Reads the first sheet of a generated application. The calculus midterm has
 * an open-ended question, so its correction stays in progress; the physics
 * quiz is all multiple choice and is done at once.
 *
 * The control is found by its accessible name, not by position, and the
 * command waits for the read counter to move before returning, so the
 * next navigation cannot cut the write short.
 */
Cypress.Commands.add('readFirstSheetOf', (title: string) => {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('a', 'Corrigir folhas').click()
  cy.get('[aria-label="Marcar a folha 1 para leitura"]').check()
  cy.contains('button', 'Ler 1 folhas').click()
  cy.contains(/\b1 de \d+ lidas/, { timeout: 10000 }).should('be.visible')
})

declare global {
  namespace Cypress {
    interface Chainable {
      findByLabel(text: string): Chainable<JQuery<HTMLElement>>
      findInDialog(selector: string, text: string): Chainable<JQuery<HTMLElement>>
      chooseSegment(text: string): Chainable<JQuery<HTMLElement>>
      generateApplication(title: string): Chainable<void>
      readFirstSheetOf(title: string): Chainable<void>
      signInAsNewTeacher(options?: { withSampleData?: boolean }): Chainable<AuthenticatedUser & { password: string }>
    }
  }
}

export {}

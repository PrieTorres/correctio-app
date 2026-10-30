import { sampleApplications, sampleClasses, sampleExams, sampleQuestions } from '@/lib/seed'
import { TOUR_STEPS } from '@/lib/tour/content'
import { TOUR_SEEN_KEY } from '@/lib/tour/seen'
import type { ApplicationInput, ClassInput, ExamInput, GenerationRequest, QuestionInput, StudentInput } from '@/lib/schemas'
import type { AnswerSheet, ApplicationOverview, AuthenticatedUser, Class, Correction, Exam, ExamVersion, Question } from '@/types/domain'

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

/**
 * The teacher a test is signed in as, kept as `@teacher` by the support file.
 * The access token is the one sign-up answered, valid for fifteen minutes,
 * which is far longer than any test: a spec that prepares data on the API
 * uses it instead of asking for a new one, which would rotate the session
 * the browser holds.
 */
export type SignedInTeacher = AuthenticatedUser & { password: string; accessToken: string }

/** A request to the API as the teacher who owns `accessToken`. */
export function apiAs(accessToken: string) {
  return <T>(method: Cypress.HttpMethod, path: string, body?: Cypress.RequestBody) =>
    cy.request<T>({ method, url: `/api${path}`, body, auth: { bearer: accessToken } })
}

type Api = ReturnType<typeof apiAs>

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
    const teacher: SignedInTeacher = { ...body.user, password: TEST_PASSWORD, accessToken: body.accessToken }
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
 * The sitting `printApplication` creates, named apart from the sample so a
 * test never confuses the two: one class with one student, one exam with one
 * multiple-choice question worth the whole grade.
 */
const PRINTED_SITTING = Object.freeze({
  group: { name: 'Geometria — Turma da consulta', subject: 'Matemática', term: '2026/2' } satisfies ClassInput,
  student: { fullName: 'Rafaela Souza', registration: '2026901' } satisfies StudentInput,
  examTitle: 'Geometria — Prova da consulta',
  statement: 'Quantos lados tem um hexágono?',
  score: 10,
  date: '2026-11-20T12:00:00.000Z',
})

/** What `printApplication` lets a test choose: P13's identification toggle. */
export interface PrintOptions {
  withStudentIdentification?: boolean
}

/**
 * One sitting printed on the API, with what a test acts on: the sheet comes
 * from the answer of the generation, so its code is never read off a table on
 * screen, and the question with its correct alternative lets the test record a
 * right answer.
 */
export interface PrintedApplication {
  applicationId: string
  examTitle: string
  studentName: string
  questionId: string
  correctAlternativeId: string
  sheet: AnswerSheet
}

interface PrintedExam {
  examId: string
  questionId: string
  correctAlternativeId: string
}

function createPrintedClass(api: Api): Cypress.Chainable<string> {
  return api<Class>('POST', '/classes', PRINTED_SITTING.group).then(({ body: group }) =>
    api('POST', `/classes/${group.id}/students`, PRINTED_SITTING.student).then(() => group.id),
  )
}

/** The alternatives keep the ids sent, as the API stores them, so the test knows which one is right. */
function createPrintedExam(api: Api): Cypress.Chainable<PrintedExam> {
  const correctAlternativeId = crypto.randomUUID()
  const question: QuestionInput = {
    type: 'objetiva',
    statement: PRINTED_SITTING.statement,
    tags: ['Geometria'],
    alternatives: [
      { id: correctAlternativeId, text: '6' },
      { id: crypto.randomUUID(), text: '5' },
    ],
    correctAlternativeId,
    allowShuffleAlternatives: false,
  }

  return api<{ id: string }>('POST', '/questions', question).then(({ body: { id: questionId } }) => {
    const exam: ExamInput = {
      title: PRINTED_SITTING.examTitle,
      description: '',
      questions: [{ questionId, order: 0, score: PRINTED_SITTING.score, allowShuffleAlternatives: false }],
      defaultShuffleQuestions: false,
      defaultShuffleAlternatives: false,
    }
    return api<{ id: string }>('POST', '/exams', exam).then(({ body }): PrintedExam => ({ examId: body.id, questionId, correctAlternativeId }))
  })
}

/**
 * Asks the API to print the sitting with a single version, which leaves one
 * sheet for the one student: the test then knows which sheet it holds without
 * choosing one by position.
 */
function printSitting(
  api: Api,
  { classId, examId, ...answer }: PrintedExam & { classId: string },
  withStudentIdentification: boolean,
): Cypress.Chainable<PrintedApplication> {
  const sitting: ApplicationInput = { examId, classId, date: PRINTED_SITTING.date }
  const generation: GenerationRequest = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification }

  return api<{ id: string }>('POST', '/applications', sitting).then(({ body: { id: applicationId } }) =>
    api<{ sheets: AnswerSheet[] }>('POST', `/applications/${applicationId}/generate-pdf`, generation).then(({ body }): PrintedApplication => {
      const [sheet] = body.sheets
      if (sheet === undefined) throw new Error('A geração não devolveu nenhuma folha.')
      return {
        applicationId,
        examTitle: PRINTED_SITTING.examTitle,
        studentName: PRINTED_SITTING.student.fullName,
        sheet,
        ...answer,
      }
    }),
  )
}

/**
 * Creates on the API everything a printed sheet hangs from, as the teacher
 * who owns `accessToken`: class, student, question, exam and application,
 * and then generates it. Each test prints its own, so the public lookup and
 * the regeneration rules are checked on paper no other test touched.
 */
Cypress.Commands.add('printApplication', (accessToken: string, { withStudentIdentification = true }: PrintOptions = {}) => {
  const api = apiAs(accessToken)
  return createPrintedClass(api)
    .then((classId) => createPrintedExam(api).then((exam) => ({ ...exam, classId })))
    .then((sitting) => printSitting(api, sitting, withStudentIdentification))
})

/**
 * Prints a sitting for the teacher the support file signed in (`@teacher`),
 * and yields it with that teacher's token, for the requests the test makes on
 * the same paper afterwards.
 */
export function printForTheTeacher(options?: PrintOptions): Cypress.Chainable<PrintedApplication & { accessToken: string }> {
  return cy
    .get<SignedInTeacher>('@teacher')
    .then(({ accessToken }) => cy.printApplication(accessToken, options).then((printed) => ({ ...printed, accessToken })))
}

/** One review of a sheet, as the grading screen (P16) would send it. */
export interface SheetReview {
  applicationId: string
  answerSheetId: string
  answers: { questionId: string; selectedAlternativeId?: string }[]
  discursiveScores?: { questionId: string; score: number }[]
  finalize: boolean
}

/**
 * Records a correction on the API, for a test that needs one already there
 * and is about something else: the public lookup, the rule that blocks
 * regenerating, the report. The grading spec makes its corrections through
 * the screens.
 */
Cypress.Commands.add('recordCorrection', (accessToken: string, { applicationId, ...review }: SheetReview) => {
  return apiAs(accessToken)<Correction>('POST', `/applications/${applicationId}/corrections`, review).then(({ body }) => body)
})

/** What the review of a sheet sends when every question is right and every open-ended one gets its whole value. */
type FullMarks = Pick<SheetReview, 'answers'> & Required<Pick<SheetReview, 'discursiveScores'>>

function fullMarksOn(api: Api, examId: string): Cypress.Chainable<FullMarks> {
  const review: FullMarks = { answers: [], discursiveScores: [] }
  return api<Exam>('GET', `/exams/${examId}`).then(({ body: exam }) => {
    for (const { questionId } of exam.questions) {
      api<Question>('GET', `/questions/${questionId}`).then(({ body: question }) => {
        if (question.type === 'discursiva') review.discursiveScores.push({ questionId, score: question.maxScore ?? 0 })
        else review.answers.push({ questionId, selectedAlternativeId: question.correctAlternativeId })
      })
    }
    return cy.wrap(null, { log: false }).then(() => review)
  })
}

/** The first sheet of the sample application of `title`, printing it first when it is still a draft. */
function firstSheetOf(api: Api, title: string): Cypress.Chainable<{ application: ApplicationOverview; sheet: AnswerSheet }> {
  return api<{ items: ApplicationOverview[] }>('GET', '/applications?pageSize=1000').then(({ body }) => {
    const application = body.items.find((item) => item.examTitle === title)
    if (application === undefined) throw new Error(`Nenhuma aplicação da prova "${title}".`)
    const generation: GenerationRequest = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification: true }
    if (application.status === 'draft') api('POST', `/applications/${application.id}/generate-pdf`, generation)
    return api<{ items: AnswerSheet[] }>('GET', `/applications/${application.id}/sheets`).then(({ body: sheets }) => {
      const [sheet] = sheets.items
      if (sheet === undefined) throw new Error(`A aplicação da prova "${title}" não tem folhas.`)
      return { application, sheet }
    })
  })
}

/**
 * Grades the first sheet of a sample application on the API, with every
 * answer right and every open-ended question at its full value, so the
 * correction is finished, as the teacher signed in (`@teacher`). The reports read the
 * corrections from the database, so the specs about them write there, apart
 * from wherever the grading screens keep theirs.
 */
Cypress.Commands.add('gradeFirstSheetOf', (title: string) => {
  return cy.get<SignedInTeacher>('@teacher').then(({ accessToken }) => {
    const api = apiAs(accessToken)
    return firstSheetOf(api, title).then(({ application, sheet }) =>
      fullMarksOn(api, application.examId).then((review) =>
        cy.recordCorrection(accessToken, { applicationId: application.id, answerSheetId: sheet.id, ...review, finalize: true }),
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
 * screens. Ends on the application page once it says the sheets are ready,
 * which proves the server finished: the title alone would not, since the
 * generation screen names the application too.
 */
Cypress.Commands.add('generateApplication', (title: string) => {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('a', 'Gerar PDF').click()
  cy.contains('h1', `Gerar PDF — ${title}`).should('be.visible')
  cy.contains('button', 'Gerar PDF').click()
  cy.contains('folhas prontas para imprimir', { timeout: 20000 }).should('be.visible')
})

/** What a photo of a sheet shows: its QR Code, the bubbles of each printed row and the ones filled in, by row. */
export interface SheetPhoto {
  qrText: string | null
  bubbles: number[]
  marks: Record<number, number[]>
}

/**
 * The card a sheet prints, photographed with the given marks: the QR Code
 * carries the sheet's code, and each row has as many bubbles as its question
 * has alternatives, none for an open-ended one, in the order of the version.
 */
export function photoOf(sheet: AnswerSheet, version: ExamVersion, marks: Record<number, number[]> = {}): SheetPhoto {
  const alternatives = new Map(version.layout.alternativeOrder.map((entry) => [entry.questionId, entry.printedOrder.length]))
  return {
    qrText: `https://correctio-app.web.app/r/${sheet.code}`,
    bubbles: version.layout.questionOrder.map((questionId) => alternatives.get(questionId) ?? 0),
    marks,
  }
}

/** The printed sheets of an application and their versions, read from the API as the teacher. */
export function printedPaperOf(accessToken: string, applicationId: string): Cypress.Chainable<{ sheets: AnswerSheet[]; versions: ExamVersion[] }> {
  const api = apiAs(accessToken)
  return api<AnswerSheet[]>('GET', `/applications/${applicationId}/sheets`).then(({ body: sheets }) =>
    api<ExamVersion[]>('GET', `/applications/${applicationId}/versions`).then(({ body: versions }) => ({ sheets, versions })),
  )
}

/**
 * Draws the photo in Node with the reader's own test kit and yields where it
 * was saved (`cypress/photos`, ignored by git). The photo is real enough for
 * the API to read, so a spec that sends it exercises the reading itself.
 */
Cypress.Commands.add('photographSheet', (photo: SheetPhoto) => {
  const path = `cypress/photos/sheet-${Date.now()}-${Cypress._.random(1e6)}.png`
  return cy.exec(`node --import tsx cypress/support/photograph-sheet.ts ${path} '${JSON.stringify(photo)}'`).then(() => path)
})

/**
 * Sends a photo through "Escolher arquivos" on P15, the way a teacher on a
 * computer does. The field hides behind its label, so the choice is forced.
 */
Cypress.Commands.add('sendSheetPhoto', (path: string) => {
  cy.findByLabel('Escolher arquivos').selectFile(path, { force: true })
})

/**
 * Corrects the first sheet of a generated application on the API, marking the
 * first printed alternative of every multiple-choice question, and opens its
 * grading screen once the list counts it. The calculus midterm has an
 * open-ended question with no score yet, so its correction stays in progress;
 * the physics quiz is all multiple choice and is done at once.
 *
 * The screens are reached through the app's links, after the write ended, so
 * no navigation cuts it short.
 */
Cypress.Commands.add('correctFirstSheetOf', (title: string) => {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('h1', title).should('be.visible')
  cy.location('pathname').then((pathname) => {
    const applicationId = pathname.split('/').pop() ?? ''
    cy.get<SignedInTeacher>('@teacher').then(({ accessToken }) =>
      printedPaperOf(accessToken, applicationId).then(({ sheets, versions }) => {
        const sheet = sheets.find((item) => item.sheetNumber === 1)
        const version = versions.find((item) => item.id === sheet?.examVersionId)
        if (sheet === undefined || version === undefined) throw new Error(`A aplicação ${title} não tem a folha 1.`)
        const answers = version.layout.alternativeOrder.map(({ questionId, printedOrder }) => ({ questionId, selectedAlternativeId: printedOrder[0] }))
        cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers, finalize: true })
      }),
    )
  })
  cy.contains('a', 'Corrigir folhas').click()
  cy.contains(/\b1 de \d+ corrigidas/, { timeout: 10000 }).should('be.visible')
})

/**
 * Opens the panel with every screen's tour already marked as seen, for a spec
 * about something the tour would sit on top of: on a phone it covers the
 * bottom of the screen, and it takes the focus when it opens. The tour itself
 * is covered by `tour.cy.ts`.
 */
Cypress.Commands.add('visitWithoutTours', () => {
  cy.visit('/painel', {
    onBeforeLoad: (win) => win.localStorage.setItem(TOUR_SEEN_KEY, JSON.stringify(Object.keys(TOUR_STEPS))),
  })
  cy.contains('h1', 'Painel').should('be.visible')
})

declare global {
  namespace Cypress {
    interface Chainable {
      findByLabel(text: string): Chainable<JQuery<HTMLElement>>
      findInDialog(selector: string, text: string): Chainable<JQuery<HTMLElement>>
      chooseSegment(text: string): Chainable<JQuery<HTMLElement>>
      generateApplication(title: string): Chainable<void>
      correctFirstSheetOf(title: string): Chainable<void>
      photographSheet(photo: SheetPhoto): Chainable<string>
      sendSheetPhoto(path: string): Chainable<void>
      signInAsNewTeacher(options?: { withSampleData?: boolean }): Chainable<SignedInTeacher>
      printApplication(accessToken: string, options?: PrintOptions): Chainable<PrintedApplication>
      recordCorrection(accessToken: string, review: SheetReview): Chainable<Correction>
      visitWithoutTours(): Chainable<void>
      gradeFirstSheetOf(title: string): Chainable<Correction>
    }
  }
}

export {}

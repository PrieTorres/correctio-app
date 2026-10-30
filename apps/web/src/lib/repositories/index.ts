import { createLocalApplicationRepository, type ApplicationRepository } from './application-repository'
import { createHttpClassRepository, createLocalClassRepository, type ClassRepository } from './class-repository'
import { createLocalExamRepository, type ExamRepository } from './exam-repository'
import { createLocalCorrectionRepository, type CorrectionRepository } from './correction-repository'
import { createHttpSheetImageRepository, createLocalSheetImageRepository, type SheetImageRepository } from './sheet-image-repository'
import { createLocalPrintingRepository, type PrintingRepository } from './printing-repository'
import {
  createHttpPublicLookupRepository,
  createLocalPublicLookupRepository,
  createPublicLookupRepository,
  type PublicLookupRepository,
} from './public-lookup-repository'
import { createLocalQuestionRepository, type QuestionRepository } from './question-repository'
import { createHttpStudentRepository, createLocalStudentRepository, type StudentRepository } from './student-repository'
import { createHttpQuestionRepository } from './http/create-http-question-repository'
import { createHttpExamRepository } from './http/create-http-exam-repository'
import { createHttpApplicationRepository } from './http/create-http-application-repository'
import { createHttpPrintingRepository } from './http/create-http-printing-repository'
import { createHttpCorrectionRepository } from './http/create-http-correction-repository'
import type { ApiClient, FileClient } from './http/api-client'

export * from './types'
export { createHttpPublicLookupRepository, createLocalPublicLookupRepository, createPublicLookupRepository }
export type {
  ApplicationRepository,
  ClassRepository,
  CorrectionRepository,
  ExamRepository,
  PrintingRepository,
  PublicLookupRepository,
  QuestionRepository,
  SheetImageRepository,
  StudentRepository,
}

export interface TeacherRepositories {
  classes: ClassRepository
  students: StudentRepository
  questions: QuestionRepository
  exams: ExamRepository
  applications: ApplicationRepository
  printing: PrintingRepository
  corrections: CorrectionRepository
  sheetImages: SheetImageRepository
}

/**
 * The single place that knows where data comes from.
 *
 * Swapping `localStorage` for the HTTP adapter happens here and nowhere else;
 * no screen, hook or schema changes.
 *
 * Named for the teacher because everything it exposes is scoped to one
 * teacher's data. A student area would add a sibling factory scoped to a
 * student, rather than widening this one.
 *
 * With an API client, the areas on the API read and write there: classes and
 * students since #42, questions since #44, exams since #45, applications
 * with their versions and sheets since #46, and the photos and corrections of
 * the sheets since #47 and #48. Without a client, which is the GitHub Pages
 * demo and the unit tests, every entry stays in this browser.
 */
export function createTeacherRepositories(teacherId: string, api?: ApiClient & FileClient): TeacherRepositories {
  return api === undefined ? createLocalTeacherRepositories(teacherId) : createHttpTeacherRepositories(api)
}

/**
 * The demo and the unit tests: the applications are generated here, from the
 * other repositories of this browser. The corrections grade against the
 * applications, which in turn count the corrections, so the corrections read
 * the applications only when asked, after both exist.
 */
export function createLocalTeacherRepositories(teacherId: string): TeacherRepositories {
  const classes = createLocalClassRepository(teacherId)
  const students = createLocalStudentRepository()
  const questions = createLocalQuestionRepository(teacherId)
  const exams = createLocalExamRepository(teacherId)
  const printing = createLocalPrintingRepository()

  const examOf = async (applicationId: string) => {
    const application = await applications.getById(applicationId)
    const exam = application === null ? null : await exams.getById(application.examId)
    if (exam === null) return null
    const found = await Promise.all(exam.questions.map((entry) => questions.getById(entry.questionId)))
    return { exam, questions: found.filter((question) => question !== null) }
  }
  const corrections = createLocalCorrectionRepository({ teacherId, sheetsOf: (id) => printing.listSheets(id), examOf })
  const applications = createLocalApplicationRepository(teacherId, { exams, classes, questions, students, printing, corrections })

  return {
    classes,
    students,
    questions,
    exams,
    applications,
    printing,
    corrections,
    sheetImages: createLocalSheetImageRepository({ contextOf: (id) => readingContextOf(printing, id) }),
  }
}

/** The sheets and the layout of each version, which the browser's reader needs (ADR-006). */
async function readingContextOf(printing: PrintingRepository, applicationId: string) {
  const [sheets, versions] = await Promise.all([printing.listSheets(applicationId), printing.listVersions(applicationId)])
  return { sheets, layouts: Object.fromEntries(versions.map((version) => [version.id, version.layout])) }
}

/**
 * Every area on the API, and nothing of the browser's: what the Firebase build
 * uses (#51). The teacher comes from the token, so no id is needed here.
 */
export function createHttpTeacherRepositories(api: ApiClient & FileClient): TeacherRepositories {
  return {
    classes: createHttpClassRepository(api),
    students: createHttpStudentRepository(api),
    questions: createHttpQuestionRepository(api),
    exams: createHttpExamRepository(api),
    applications: createHttpApplicationRepository(api),
    printing: createHttpPrintingRepository(api),
    corrections: createHttpCorrectionRepository(api),
    sheetImages: createHttpSheetImageRepository(api),
  }
}

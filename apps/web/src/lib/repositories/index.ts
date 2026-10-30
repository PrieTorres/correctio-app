import { createLocalApplicationRepository, type ApplicationRepository } from './application-repository'
import { createHttpClassRepository, createLocalClassRepository, type ClassRepository } from './class-repository'
import { createLocalExamRepository, type ExamRepository } from './exam-repository'
import { createLocalCorrectionRepository, type CorrectionRepository } from './correction-repository'
import { createLocalPrintingRepository, type PrintingRepository } from './printing-repository'
import { createPublicLookupRepository, type PublicLookupRepository } from './public-lookup-repository'
import { createLocalQuestionRepository, type QuestionRepository } from './question-repository'
import { createLocalReportRepository, type CorrectionsByApplication, type ReportFile, type ReportRepository } from './report-repository'
import { createHttpStudentRepository, createLocalStudentRepository, type StudentRepository } from './student-repository'
import { createHttpQuestionRepository } from './http/create-http-question-repository'
import { createHttpExamRepository } from './http/create-http-exam-repository'
import { createHttpApplicationRepository } from './http/create-http-application-repository'
import { createHttpPrintingRepository } from './http/create-http-printing-repository'
import { createHttpReportRepository } from './http/create-http-report-repository'
import type { ApiClient, FileClient } from './http/api-client'

export * from './types'
export { createPublicLookupRepository }
export type {
  ApplicationRepository,
  ClassRepository,
  CorrectionRepository,
  ExamRepository,
  PrintingRepository,
  PublicLookupRepository,
  QuestionRepository,
  ReportFile,
  ReportRepository,
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
  /** The panel and the reports, calculated on the API since #50. */
  reports: ReportRepository
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
 * with their versions and sheets since #46, and the panel and the reports
 * since #50. The corrections switch in the
 * issue that wires their screens to the API (#48). Without a client, which is
 * the GitHub Pages demo and the unit tests, every entry stays in this browser.
 */
export function createTeacherRepositories(teacherId: string, api?: ApiClient & FileClient): TeacherRepositories {
  const corrections = createLocalCorrectionRepository()
  return api === undefined ? inThisBrowser(teacherId, corrections) : onTheApi(api, corrections)
}

/** The demo and the unit tests: the applications are generated here, from the other repositories of this browser. */
function inThisBrowser(teacherId: string, corrections: CorrectionRepository): TeacherRepositories {
  const classes = createLocalClassRepository(teacherId)
  const students = createLocalStudentRepository()
  const questions = createLocalQuestionRepository(teacherId)
  const exams = createLocalExamRepository(teacherId)
  const printing = createLocalPrintingRepository()
  const applications = createLocalApplicationRepository(teacherId, { exams, classes, questions, students, printing, corrections })

  return {
    classes,
    students,
    questions,
    exams,
    applications,
    printing,
    corrections,
    reports: createLocalReportRepository({ classes, questions, exams, applications, students, printing, corrections: byApplication(corrections, printing) }),
  }
}

/**
 * The corrections of each application, reached through its sheets because the
 * browser keeps them by sheet. The API lists them under the application.
 */
function byApplication(corrections: CorrectionRepository, printing: PrintingRepository): CorrectionsByApplication {
  return {
    async listByApplication(applicationId) {
      const sheets = await printing.listSheets(applicationId)
      return corrections.listByAnswerSheets(sheets.map((sheet) => sheet.id))
    },
  }
}

function onTheApi(api: ApiClient & FileClient, corrections: CorrectionRepository): TeacherRepositories {
  return {
    classes: createHttpClassRepository(api),
    students: createHttpStudentRepository(api),
    questions: createHttpQuestionRepository(api),
    exams: createHttpExamRepository(api),
    applications: createHttpApplicationRepository(api),
    printing: createHttpPrintingRepository(api),
    corrections,
    reports: createHttpReportRepository(api),
  }
}

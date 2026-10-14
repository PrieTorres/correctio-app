import { createLocalApplicationRepository, type ApplicationRepository } from './application-repository'
import { createLocalClassRepository, type ClassRepository } from './class-repository'
import { createLocalExamRepository, type ExamRepository } from './exam-repository'
import { createLocalCorrectionRepository, type CorrectionRepository } from './correction-repository'
import { createLocalPrintingRepository, type PrintingRepository } from './printing-repository'
import { createLocalQuestionRepository, type QuestionRepository } from './question-repository'
import { createLocalStudentRepository, type StudentRepository } from './student-repository'
import type { ApiClient } from './http/api-client'

export * from './types'
export type {
  ApplicationRepository,
  ClassRepository,
  CorrectionRepository,
  ExamRepository,
  PrintingRepository,
  QuestionRepository,
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
 * Each entry switches to its HTTP version (`createHttpOwnedRepository` with
 * `_api`) in the issue that wires its screens to the API: #42, #44, #45, #46,
 * #48, #49 and #50. Until the first one does, the client is unused; the local
 * versions stay, so the published site does not change.
 */
export function createTeacherRepositories(teacherId: string, _api?: ApiClient): TeacherRepositories {
  return {
    classes: createLocalClassRepository(teacherId),
    students: createLocalStudentRepository(),
    questions: createLocalQuestionRepository(teacherId),
    exams: createLocalExamRepository(teacherId),
    applications: createLocalApplicationRepository(teacherId),
    printing: createLocalPrintingRepository(),
    corrections: createLocalCorrectionRepository(),
  }
}
